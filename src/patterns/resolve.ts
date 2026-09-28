import { branchTarget } from '../binary/branch';
import { getPattern, getUniquePattern } from './signature';
import { maskInstruction, maskInstructionStrict } from './wildcards';
import { scan, filterMatches } from './scan';
import type { Disassembler } from '../disassembler';
import { nativeControlFlowFilter } from '../binary/native-analysis';

/** The source signature remains available when a verified trampoline changes the destination pattern. */
export type PatternResolution = {
  pattern: string;
  sourcePattern: string;
  length: number;
  matches: number[];
  sourceMatches: number[];
  strategy: 'exact' | 'extended' | 'multi-window' | 'trampoline';
};

export function initialPattern(
  disassembler: Disassembler,
  source: Buffer,
  offset: number,
  maxLength: number,
): { pattern: string; length: number } {
  const available = Math.min(maxLength, source.length - offset);
  const firstLength = Math.min(48, Math.floor(available / 4) * 4);
  if (firstLength <= 0) return { pattern: '', length: 0 };
  const instructions = disassembler.disasm(source.subarray(offset, offset + firstLength), offset);
  const parts: string[] = [];
  for (const instruction of instructions) {
    const masked = maskInstruction(instruction);
    parts.push(masked.slice(0, 2), masked.slice(2, 4), masked.slice(4, 6), masked.slice(6, 8));
  }
  return { pattern: parts.join(' '), length: parts.length };
}

function controlFlowShape(disassembler: Disassembler, bytes: Buffer, address: number) {
  const instructions = disassembler.disasm(bytes, address);
  const mnemonics = instructions.map((instruction) => instruction.mnemonic);
  const branches = mnemonics
    .map((mnemonic, index) =>
      /^(?:b(?:\.|$)|bl$|br$|blr$|cbz$|cbnz$|tbz$|tbnz$|ret$)/.test(mnemonic)
        ? `${index}:${mnemonic}`
        : null,
    )
    .filter((value): value is string => value !== null);
  return { mnemonics, branches };
}

async function resolveMultiWindow(
  disassembler: Disassembler,
  source: Buffer,
  destination: Buffer,
  offset: number,
  available: number,
  existingDestinationCandidates: number[],
): Promise<PatternResolution | null> {
  const evidenceLength = Math.min(Math.floor(available / 4) * 4, 384);
  const windowLength = 32;
  if (evidenceLength < windowLength * 3) return null;

  const span = evidenceLength - windowLength;
  const offsets = [
    ...new Set([0, Math.floor(span / 3 / 4) * 4, Math.floor((span * 2) / 3 / 4) * 4, span]),
  ];
  if (offsets.length < 3) return null;
  const windows = await Promise.all(
    offsets.map(async (relative) => ({
      relative,
      parts: (await getPattern(disassembler, source, offset + relative, windowLength)).split(' '),
    })),
  );
  const sourceFlow = controlFlowShape(
    disassembler,
    source.subarray(offset, offset + evidenceLength),
    offset,
  );

  // Try all three-of-four combinations so one changed region cannot sink the
  // whole signature. Wildcard gaps keep the result compatible with scan().
  for (let omitted = -1; omitted < windows.length; omitted++) {
    const selected = windows.filter((_, index) => index !== omitted);
    if (selected.length < 3) continue;
    const parts = new Array<string>(evidenceLength).fill('??');
    for (const window of selected) {
      for (let i = 0; i < window.parts.length; i++) parts[window.relative + i] = window.parts[i];
    }
    const pattern = parts.join(' ');
    const sourceMatches = scan(pattern, source);
    if (sourceMatches.length !== 1 || sourceMatches[0] !== offset) continue;
    const rawCandidates = existingDestinationCandidates.length
      ? filterMatches(destination, existingDestinationCandidates, pattern, 0)
      : scan(pattern, destination);
    const candidates = rawCandidates.filter(
      (candidate) => candidate % 4 === 0 && candidate + evidenceLength <= destination.length,
    );
    const nativeVerified = nativeControlFlowFilter(
      source,
      offset,
      destination,
      candidates,
      evidenceLength,
    );
    const verified =
      nativeVerified ??
      candidates.filter((candidate) => {
        const flow = controlFlowShape(
          disassembler,
          destination.subarray(candidate, candidate + evidenceLength),
          candidate,
        );
        if (flow.branches.join('|') !== sourceFlow.branches.join('|')) return false;
        if (flow.mnemonics.length !== sourceFlow.mnemonics.length) return false;
        let equal = 0;
        for (let i = 0; i < flow.mnemonics.length; i++) {
          if (flow.mnemonics[i] === sourceFlow.mnemonics[i]) equal++;
        }
        return equal / sourceFlow.mnemonics.length >= 0.9;
      });
    if (verified.length === 1) {
      return {
        pattern,
        sourcePattern: pattern,
        length: evidenceLength,
        matches: verified,
        sourceMatches,
        strategy: 'multi-window',
      };
    }
  }
  return null;
}

function compile(pattern: string) {
  const parts = pattern.split(' ');
  return {
    values: parts.map((part) => parseInt(part.replace(/\?/g, '0'), 16)),
    masks: parts.map((part) => (part[0] === '?' ? 0 : 0xf0) | (part[1] === '?' ? 0 : 0x0f)),
  };
}

function matchesAt(
  data: Buffer,
  start: number,
  pattern: ReturnType<typeof compile>,
  from = 0,
  to = pattern.values.length,
) {
  if (start < 0 || start + to > data.length) return false;
  for (let i = from; i < to; i++) {
    if ((data[start + i] & pattern.masks[i]) !== pattern.values[i]) return false;
  }
  return true;
}

const HEX_MAP = new Int16Array(256).fill(-1);
for (let c = 0; c <= 9; c++) HEX_MAP[48 + c] = c;
for (let c = 0; c <= 5; c++) {
  HEX_MAP[65 + c] = 10 + c;
  HEX_MAP[97 + c] = 10 + c;
}

function parsePartFast(part: string): { val: number; mask: number } {
  const c0 = part.charCodeAt(0);
  const c1 = part.charCodeAt(1);
  const v0 = HEX_MAP[c0];
  const v1 = HEX_MAP[c1];
  return {
    val: (v0 > 0 ? v0 << 4 : 0) | (v1 > 0 ? v1 : 0),
    mask: (c0 === 63 ? 0 : 0xf0) | (c1 === 63 ? 0 : 0x0f),
  };
}

/** Match in both builds; only accept a trampoline after checking the displaced load and exact return. */
export async function resolvePattern(
  disassembler: Disassembler,
  source: Buffer,
  destination: Buffer,
  offset: number,
  maxLength: number,
  initial?: { pattern: string; length: number; matches: number[] },
): Promise<PatternResolution> {
  const available = Math.min(maxLength, source.length - offset);
  const firstLength = Math.min(48, Math.floor(available / 4) * 4);
  if (firstLength <= 0) {
    return {
      pattern: '',
      sourcePattern: '',
      length: 0,
      matches: [],
      sourceMatches: [],
      strategy: 'exact',
    };
  }

  // 1. Disassemble the first 48 bytes of source
  const seed = initial ?? initialPattern(disassembler, source, offset, maxLength);
  const parts = seed.pattern ? seed.pattern.split(' ') : [];

  let length = parts.length;
  if (length === 0) {
    return {
      pattern: '',
      sourcePattern: '',
      length: 0,
      matches: [],
      sourceMatches: [],
      strategy: 'exact',
    };
  }

  const pattern48 = parts.join(' ');

  // 2. Scan destination with 48-byte pattern
  let matches = initial ? initial.matches : scan(pattern48, destination);

  // Fast path: In ~99% of cases, the 48-byte method pattern is uniquely matched in destination.
  // In this common case, we return immediately in < 1ms without a redundant 67MB scan of source.
  if (length === firstLength && matches.length === 1) {
    return {
      pattern: pattern48,
      sourcePattern: pattern48,
      length,
      matches,
      sourceMatches: [offset],
      strategy: 'exact',
    };
  }

  // 3. Destination had collisions (>1 matches) or 0 matches:
  // Scan source at 48 bytes to establish source candidates.
  let sourceMatches = scan(pattern48, source);

  if (sourceMatches.length === 1 && sourceMatches[0] === offset && matches.length === 1) {
    return {
      pattern: pattern48,
      sourcePattern: pattern48,
      length,
      matches,
      sourceMatches,
      strategy: 'exact',
    };
  }

  const compiled = { values: [] as number[], masks: [] as number[] };
  for (let i = 0; i < parts.length; i++) {
    const p = parsePartFast(parts[i]);
    compiled.values.push(p.val);
    compiled.masks.push(p.mask);
  }

  // Helper to extend disassembled instructions from source
  const extendSource = (targetLimit: number) => {
    while (parts.length < targetLimit) {
      const chunkLen = Math.min(48, targetLimit - parts.length);
      const chunkHex = source.subarray(offset + parts.length, offset + parts.length + chunkLen);
      const chunkInstrs = disassembler.disasm(chunkHex, offset + parts.length);
      if (!chunkInstrs || chunkInstrs.length === 0) break;

      const prevLen = parts.length;
      for (let j = 0; j < chunkInstrs.length; j++) {
        const m8 = maskInstruction(chunkInstrs[j]);
        const p0 = m8.slice(0, 2),
          p1 = m8.slice(2, 4),
          p2 = m8.slice(4, 6),
          p3 = m8.slice(6, 8);
        parts.push(p0, p1, p2, p3);
        const r0 = parsePartFast(p0),
          r1 = parsePartFast(p1),
          r2 = parsePartFast(p2),
          r3 = parsePartFast(p3);
        compiled.values.push(r0.val, r1.val, r2.val, r3.val);
        compiled.masks.push(r0.mask, r1.mask, r2.mask, r3.mask);
      }
      if (parts.length === prevLen) break;
    }
  };

  // Find shortest length where source is uniquely matched (reproducing getUniquePattern)
  while (length < available && !(sourceMatches.length === 1 && sourceMatches[0] === offset)) {
    const targetLimit = Math.min(available, length + 48);
    extendSource(targetLimit);
    const limit = Math.min(parts.length, Math.floor(available / 4) * 4);
    if (limit <= length) break;

    while (length < limit && !(sourceMatches.length === 1 && sourceMatches[0] === offset)) {
      const nextLength = Math.min(length + 12, limit);
      const nextPattern = parts.slice(0, nextLength).join(' ');
      sourceMatches = filterMatches(source, sourceMatches, nextPattern, length);
      length = nextLength;
    }
  }

  // Filter destination matches up to length
  if (matches.length > 0) {
    const currentPattern = parts.slice(0, length).join(' ');
    matches = filterMatches(destination, matches, currentPattern, 0);
  }

  let strategy: PatternResolution['strategy'] = 'exact';
  if (
    !length ||
    (sourceMatches.length === 1 && sourceMatches[0] === offset && matches.length === 1)
  ) {
    const pattern = parts.slice(0, length).join(' ');
    return { pattern, sourcePattern: pattern, length, matches, sourceMatches, strategy };
  }

  // A destination collision can require more evidence than source uniqueness.
  if (matches.length > 1) {
    while (length < maxLength && matches.length > 1) {
      if (length >= parts.length) {
        extendSource(Math.min(maxLength, length + 48));
        if (length >= parts.length) break;
      }
      const next = Math.min(length + 12, parts.length);
      if (next <= length) break;
      const nextPattern = parts.slice(0, next).join(' ');
      matches = filterMatches(destination, matches, nextPattern, length);
      sourceMatches = filterMatches(source, sourceMatches, nextPattern, length);
      length = next;
    }
    strategy = 'extended';

    // Portable masks intentionally ignore relocatable field offsets. If that
    // leaves multiple candidates, retry those candidates with stable small
    // offsets retained. Never use the strict form after a portable miss: that
    // would trade compatibility for false negatives.
    if (matches.length > 1) {
      const strictPattern = await getPattern(
        disassembler,
        source,
        offset,
        length,
        maskInstructionStrict,
      );
      const strictMatches = filterMatches(destination, matches, strictPattern, 0);
      if (strictMatches.length === 1) {
        const strictSourceMatches = filterMatches(source, sourceMatches, strictPattern, 0);
        if (strictSourceMatches.length === 1 && strictSourceMatches[0] === offset) {
          return {
            pattern: strictPattern,
            sourcePattern: strictPattern,
            length,
            matches: strictMatches,
            sourceMatches: strictSourceMatches,
            strategy,
          };
        }
      }
    }
  }

  const pattern = parts.slice(0, length).join(' ');
  const sourcePattern = pattern;
  if (!(sourceMatches.length === 1 && sourceMatches[0] === offset && matches.length === 1)) {
    const multiWindow = await resolveMultiWindow(
      disassembler,
      source,
      destination,
      offset,
      available,
      matches,
    );
    if (multiWindow) return multiWindow;
  }
  if (matches.length || sourceMatches.length !== 1 || sourceMatches[0] !== offset || length < 48) {
    return { pattern, sourcePattern, length, matches, sourceMatches, strategy };
  }

  // One substituted instruction leaves at least one half intact. Use those halves
  // only to discover candidates; validate every instruction before accepting one.
  const trampParts = pattern.split(' ');
  const split = Math.floor(length / 8) * 4;
  const candidates = new Set([
    ...scan(trampParts.slice(0, split).join(' '), destination),
    ...scan(trampParts.slice(split).join(' '), destination).map((hit) => hit - split),
  ]);
  const trampCompiled = compile(pattern);
  const verified: { start: number; changed: number }[] = [];
  for (const start of candidates) {
    if (start < 0 || start % 4 || start + length > destination.length) continue;
    let changed = -1;
    let valid = true;
    for (let i = 0; i < length; i += 4) {
      if (matchesAt(destination, start, trampCompiled, i, i + 4)) continue;
      if (changed !== -1) {
        valid = false;
        break;
      }
      const original = disassembler.disasm(
        source.subarray(offset + i, offset + i + 4),
        offset + i,
      )[0];
      // Register-relative loads are position independent; PC-relative loads are not.
      if (
        !original ||
        !/^ldr(?:b|h|sw)?$/.test(original.mnemonic) ||
        !original.op_str.includes('[')
      ) {
        valid = false;
        break;
      }
      const target = branchTarget(destination, start + i);
      if (
        target === null ||
        (target >= start && target < start + length) ||
        !matchesAt(destination, target - i, trampCompiled, i, i + 4) ||
        branchTarget(destination, target + 4) !== start + i + 4
      ) {
        valid = false;
        break;
      }
      changed = i;
    }
    if (valid && changed !== -1) verified.push({ start, changed });
  }
  if (verified.length === 1) {
    const { start, changed } = verified[0];
    const adapted = [...trampParts];
    adapted.splice(changed, 4, '??', '??', '??', '1?');
    const adaptedPattern = adapted.join(' ');
    // Export a normal scan-compatible pattern only if it independently stays unique.
    const adaptedMatches = scan(adaptedPattern, destination);
    if (adaptedMatches.length === 1 && adaptedMatches[0] === start) {
      return {
        pattern: adaptedPattern,
        sourcePattern,
        length,
        matches: adaptedMatches,
        sourceMatches,
        strategy: 'trampoline',
      };
    }
  }
  return { pattern, sourcePattern, length, matches, sourceMatches, strategy };
}
