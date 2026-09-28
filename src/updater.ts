import { readFile } from 'node:fs/promises';
import { createDisassembler } from './disassembler';
import { readMetadata } from './binary/metadata';
import { readOffsets } from './io/offsets';
import { formatOffset, writeResults, type UpdatedOffset } from './io/output';
import type { UpdaterConfig } from './io/config';
import { initialPattern, resolvePattern } from './patterns/resolve';
import { batchScan } from './patterns/scan';
import { xrefResolve, type ResolvedMethod, type PendingMethod } from './binary/xref';
import { vtableResolve, parseSegments, vaToFile, fileToVA } from './binary/vtable';
import { rodataResolve } from './binary/rodata';

export async function updateOffsets(
  config: UpdaterConfig,
  log?: (message: string) => void,
): Promise<{ resolved: number; total: number }> {
  const emit = log ?? (() => {});
  const started = performance.now();
  emit('[load] Reading libraries, offsets, and metadata...');
  const [source, destination, entries, metadata, fallbackDumpStr] = await Promise.all([
    readFile(config.oldLibrary),
    readFile(config.newLibrary),
    readOffsets(config.offsets),
    config.oldDump ? readMetadata(config.oldDump) : Promise.resolve(undefined),
    config.newDump ? readFile(config.newDump, 'utf8') : Promise.resolve(undefined),
  ]);
  emit(
    `[load] Ready: ${entries.length} methods, ${(source.length / 1024 / 1024).toFixed(1)} MiB source, ${(destination.length / 1024 / 1024).toFixed(1)} MiB destination`,
  );

  let fallbackDump: Map<string, { Address: number; Signature: string }[]> | null = null;
  if (fallbackDumpStr) {
    try {
      const parsed = JSON.parse(fallbackDumpStr);
      fallbackDump = new Map();
      for (const m of parsed.ScriptMethod) {
        const methods = fallbackDump.get(m.Name) ?? [];
        methods.push({ Address: Number(m.Address), Signature: String(m.Signature) });
        fallbackDump.set(m.Name, methods);
      }
      emit(`Loaded ${fallbackDump.size} fallback methods from newDump.`);
    } catch (e) {
      emit(`Failed to parse newDump: ${e}`);
    }
  }

  const disassembler = createDisassembler();
  const destinationSegments = parseSegments(destination);
  const oracleCache = new Map<string, number | null>();
  const destinationOracle = (name: string, sourceOffset: number): number | undefined => {
    const cacheKey = `${sourceOffset}:${name}`;
    const cached = oracleCache.get(cacheKey);
    if (cached !== undefined) return cached === null ? undefined : cached;
    const methods = fallbackDump?.get(name) ?? [];
    const sourceIdentity = metadata
      ?.identify(name)
      .find((method) => method.Address === sourceOffset);
    const candidates = sourceIdentity
      ? methods.filter((method) => method.Signature === sourceIdentity.Signature)
      : methods;
    if (candidates.length !== 1) {
      oracleCache.set(cacheKey, null);
      return undefined;
    }
    const result = vaToFile(destinationSegments, BigInt(candidates[0].Address)) ?? undefined;
    oracleCache.set(cacheKey, result ?? null);
    return result;
  };
  const results: UpdatedOffset[] = [];
  let resolvedCount = 0;

  const xrefResolved: ResolvedMethod[] = [];
  const xrefPending: PendingMethod[] = [];
  let ambiguousCount = 0;
  let missingCount = 0;

  try {
    emit('[patterns] Resolving byte signatures...');
    const lengths = entries.map(({ offset }) => {
      const next = metadata?.nextAddress(offset);
      return Math.min(config.signatureLength, next === undefined ? Infinity : next - offset);
    });
    const seeds = entries.map(({ offset }, index) =>
      initialPattern(disassembler, source, offset, lengths[index]),
    );
    const uniquePatterns = [...new Set(seeds.map((seed) => seed.pattern))];
    const uniqueMatches = batchScan(uniquePatterns, destination);
    const matchByPattern = new Map(
      uniquePatterns.map((pattern, index) => [pattern, uniqueMatches[index]]),
    );
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      const { offset, name } = entries[entryIndex];
      if (offset % 4 || offset + 4 > source.length)
        throw new Error(
          `${name}: offset must address an AArch64 instruction within the source file`,
        );
      const next = metadata?.nextAddress(offset);
      const length = lengths[entryIndex];
      const sourceBodyLength = next !== undefined ? next - offset : Math.min(length * 2, 512);

      const start = performance.now();
      const seed = seeds[entryIndex];
      const initialMatches = matchByPattern.get(seed.pattern);
      const result = await resolvePattern(
        disassembler,
        source,
        destination,
        offset,
        length,
        initialMatches ? { ...seed, matches: initialMatches } : undefined,
      );
      const patternUnique =
        result.sourceMatches.length === 1 &&
        result.sourceMatches[0] === offset &&
        result.matches.length === 1;
      const oracleOffset = destinationOracle(name, offset);
      const metadataCorrected =
        patternUnique && oracleOffset !== undefined && result.matches[0] !== oracleOffset;
      const unique = patternUnique && !metadataCorrected;

      if (unique) {
        resolvedCount++;
        results.push({ name, offsets: result.matches, pattern: result.pattern });
        xrefResolved.push({
          name,
          sourceOffset: offset,
          destOffset: result.matches[0],
          sourceBodyLength,
        });
      } else if (metadataCorrected) {
        resolvedCount++;
        results.push({ name, offsets: [oracleOffset!], pattern: 'fallback' });
        xrefResolved.push({
          name,
          sourceOffset: offset,
          destOffset: oracleOffset!,
          sourceBodyLength,
        });
      } else if (result.matches.length > 1) {
        if (config.xrefResolution) {
          xrefPending.push({
            name,
            sourceOffset: offset,
            candidates: result.matches,
            sourceBodyLength,
          });
        }
      }

      const status = unique
        ? 'resolved'
        : metadataCorrected
          ? 'metadata-corrected'
          : result.matches.length
            ? 'ambiguous'
            : 'not found';
      if (status === 'ambiguous') ambiguousCount++;
      if (status === 'not found') missingCount++;
      if (!unique && !result.matches.length && config.xrefResolution) {
        // Push 0-match candidates so vtableResolve can attempt to find them
        xrefPending.push({ name, sourceOffset: offset, candidates: [], sourceBodyLength });
      }
      if (log) {
        const shown = result.matches.slice(0, 8).map(formatOffset).join(', ');
        const omitted = result.matches.length > 8 ? `, … +${result.matches.length - 8} more` : '';
        emit(
          `${name}: ${status}${shown ? ` at ${shown}${omitted}` : ''} (${result.length} bytes, ${(performance.now() - start).toFixed(2)} ms)`,
        );
      }
      const completed = entryIndex + 1;
      if (completed % 100 === 0 || completed === entries.length) {
        emit(
          `[patterns] ${completed}/${entries.length}: ${resolvedCount} resolved, ${ambiguousCount} ambiguous, ${missingCount} not found`,
        );
      }
    }

    if (config.xrefResolution && xrefPending.length > 0) {
      const initialResolved = xrefResolved.length;
      emit(`[fallback] Trying rodata for ${xrefPending.length} unresolved methods...`);
      const rodataStart = performance.now();
      const rodataRes = rodataResolve({
        source,
        destination,
        pending: xrefPending,
      });

      const postRodataPending: PendingMethod[] = [];
      for (const m of xrefPending) {
        const res = rodataRes.get(m.name);
        if (res !== undefined) {
          const verified = destinationOracle(m.name, m.sourceOffset) ?? res;
          xrefResolved.push({
            name: m.name,
            sourceOffset: m.sourceOffset,
            destOffset: verified,
            sourceBodyLength: 0,
          });
          results.push({
            name: m.name,
            offsets: [verified],
            pattern: verified === res ? 'rodata-resolved' : 'fallback',
          });
          resolvedCount++;
          emit(`${m.name}: rodata-resolved at 0x${res.toString(16).toUpperCase()}`);
        } else {
          postRodataPending.push(m);
        }
      }
      emit(
        `[fallback] rodata resolved ${xrefPending.length - postRodataPending.length}/${xrefPending.length} in ${(performance.now() - rodataStart).toFixed(0)} ms`,
      );

      const xrefStart = performance.now();
      emit(`[fallback] Trying call xrefs for ${postRodataPending.length} methods...`);
      const newResolved = xrefResolve({
        source,
        destination,
        pending: postRodataPending,
        resolved: xrefResolved,
      });

      const remainingPending: PendingMethod[] = [];
      for (const m of postRodataPending) {
        const res = newResolved.get(m.name);
        if (res !== undefined) {
          const verified = destinationOracle(m.name, m.sourceOffset) ?? res;
          xrefResolved.push({
            name: m.name,
            sourceOffset: m.sourceOffset,
            destOffset: verified,
            sourceBodyLength: 0,
          });
          results.push({
            name: m.name,
            offsets: [verified],
            pattern: verified === res ? 'vtable-xref-resolved' : 'fallback',
          });
          resolvedCount++;
          emit(`${m.name}: vtable-xref-resolved at 0x${res.toString(16).toUpperCase()}`);
        } else {
          remainingPending.push(m);
        }
      }
      emit(
        `[fallback] call xrefs resolved ${postRodataPending.length - remainingPending.length}/${postRodataPending.length} in ${(performance.now() - xrefStart).toFixed(0)} ms`,
      );

      const vtableStart = performance.now();
      emit(`[fallback] Trying vtables for ${remainingPending.length} methods...`);
      const vtableRes = vtableResolve({
        source,
        destination,
        pending: remainingPending,
        resolved: xrefResolved,
      });

      let finalResolvedCount = 0;
      for (const m of remainingPending) {
        const res = vtableRes.get(m.name);
        const fallbackOffset = destinationOracle(m.name, m.sourceOffset);

        // A supplied destination dump is an independent identity oracle and
        // takes precedence over heuristic vtable voting when they disagree.
        // This prevents a strong-looking neighboring vtable from silently
        // selecting the wrong method.
        if (fallbackOffset !== undefined && res !== fallbackOffset) {
          xrefResolved.push({
            name: m.name,
            sourceOffset: m.sourceOffset,
            destOffset: fallbackOffset,
            sourceBodyLength: 0,
          });
          results.push({ name: m.name, offsets: [fallbackOffset], pattern: 'fallback' });
          resolvedCount++;
          finalResolvedCount++;
          emit(`${m.name}: metadata-resolved at ${formatOffset(fallbackOffset)}`);
          continue;
        }

        if (res !== undefined) {
          xrefResolved.push({
            name: m.name,
            sourceOffset: m.sourceOffset,
            destOffset: res,
            sourceBodyLength: 0,
          });
          results.push({ name: m.name, offsets: [res], pattern: 'vtable-xref-resolved' });
          resolvedCount++;
          finalResolvedCount++;
          emit(`${m.name}: vtable-xref-resolved at 0x${res.toString(16).toUpperCase()}`);
          continue;
        }

        if (fallbackOffset !== undefined) {
          xrefResolved.push({
            name: m.name,
            sourceOffset: m.sourceOffset,
            destOffset: fallbackOffset,
            sourceBodyLength: 0,
          });
          results.push({ name: m.name, offsets: [fallbackOffset], pattern: 'fallback' });
          resolvedCount++;
          finalResolvedCount++;
          emit(`${m.name}: fallback-resolved at ${formatOffset(fallbackOffset)}`);
          continue;
        }
      }

      emit(`Vtable pass: resolved ${finalResolvedCount}/${remainingPending.length} methods`);
      emit(
        `[fallback] vtables and metadata completed in ${(performance.now() - vtableStart).toFixed(0)} ms`,
      );
      emit(
        `XRef total: resolved ${xrefResolved.length - initialResolved}/${xrefPending.length} methods in ${(performance.now() - xrefStart).toFixed(2)} ms`,
      );
    }

    emit('[output] Writing offsets and signatures...');
    await writeResults(config.offsetOutput, config.signatureOutput, results);
    emit(
      `[done] ${resolvedCount}/${entries.length} methods resolved in ${(performance.now() - started).toFixed(0)} ms`,
    );
  } finally {
    disassembler.close();
  }
  return { resolved: resolvedCount, total: entries.length };
}
