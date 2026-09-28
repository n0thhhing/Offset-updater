import { blTarget } from './branch';
import { nativeCallTargets } from './native-analysis';

export interface ResolvedMethod {
  name?: string;
  sourceOffset: number;
  destOffset: number;
  /** Number of source bytes to scan for outgoing BL calls (ideally full function body length). */
  sourceBodyLength: number;
}

export interface PendingMethod {
  name: string;
  sourceOffset: number;
  /** All candidate destination file offsets that matched the pattern scan (length > 1). */
  candidates: number[];
  /** Known source body length, used for outgoing-call fingerprints. */
  sourceBodyLength?: number;
}

/**
 * Scan all resolved method source bodies for BL instructions and build a reverse caller map:
 *   calledSourceFileOffset → [callerSourceFileOffset, ...]
 */
function buildCallerMap(source: Buffer, resolved: ResolvedMethod[]): Map<number, number[]> {
  const callerMap = new Map<number, number[]>();
  const nativeTargets = nativeCallTargets(
    source,
    resolved.map((method) => ({ start: method.sourceOffset, length: method.sourceBodyLength })),
  );
  for (let methodIndex = 0; methodIndex < resolved.length; methodIndex++) {
    const method = resolved[methodIndex];
    if (nativeTargets) {
      for (const target of nativeTargets[methodIndex]) {
        let list = callerMap.get(target);
        if (!list) callerMap.set(target, (list = []));
        list.push(method.sourceOffset);
      }
      continue;
    }
    const end = Math.min(method.sourceOffset + method.sourceBodyLength, source.length - 3);
    for (let pos = method.sourceOffset; pos < end; pos += 4) {
      const target = blTarget(source, pos);
      if (target === null) continue;
      let list = callerMap.get(target);
      if (!list) callerMap.set(target, (list = []));
      list.push(method.sourceOffset);
    }
  }
  return callerMap;
}

/**
 * Collect all BL targets within a window of the destination binary starting at destOffset.
 */
function collectBlTargets(destination: Buffer, destOffset: number, window: number): Set<number> {
  const native = nativeCallTargets(destination, [{ start: destOffset, length: window }]);
  if (native) return native[0];
  const targets = new Set<number>();
  const end = Math.min(destOffset + window, destination.length - 3);
  for (let pos = destOffset; pos < end; pos += 4) {
    const t = blTarget(destination, pos);
    if (t !== null) targets.add(t);
  }
  return targets;
}

/**
 * Iteratively resolve ambiguous methods using cross-references from already-resolved callers.
 *
 * Algorithm per iteration:
 *  1. Build a caller map from all currently resolved source bodies.
 *  2. For each pending method M:
 *     a. Find which resolved methods call M.sourceOffset via BL.
 *     b. For each such caller, scan its destination body for BL targets.
 *     c. Intersect those targets with M.candidates.
 *     d. If all agreeing callers converge on exactly 1 candidate → M is resolved.
 *  3. Newly resolved methods become available as callers in the next iteration.
 *  4. Repeat until fixed point or maxIterations.
 *
 * Callers that produce zero hits (i.e. the BL isn't visible in their destination window)
 * are skipped. Callers that disagree on the candidate narrow the intersection — if it
 * reaches zero the method stays pending (conservative, never guesses wrong).
 *
 * Returns a map of method name → resolved destination file offset.
 */
export function xrefResolve(params: {
  source: Buffer;
  destination: Buffer;
  pending: PendingMethod[];
  resolved: ResolvedMethod[];
  /**
   * Destination scan window per caller = min(sourceBodyLength * 2, destScanCap).
   * Default 512 bytes — wide enough for medium functions, avoids false positives.
   */
  destScanCap?: number;
  maxIterations?: number;
}): Map<string, number> {
  const { source, destination, destScanCap = 512, maxIterations = 10 } = params;

  const resolvedList: ResolvedMethod[] = [...params.resolved];
  const resolvedBySource = new Map<number, ResolvedMethod>(
    resolvedList.map((r) => [r.sourceOffset, r]),
  );
  let pending: PendingMethod[] = [...params.pending];
  const allNewlyResolved = new Map<string, number>();

  for (let iter = 0; iter < maxIterations && pending.length > 0; iter++) {
    const callerMap = buildCallerMap(source, resolvedList);
    const stillPending: PendingMethod[] = [];
    let progress = false;

    for (const method of pending) {
      // First compare outgoing calls to methods whose source/destination pair is
      // already known. This is independent of raw bytes and survives relocation.
      if (method.candidates.length > 1) {
        const bodyLength = Math.min(method.sourceBodyLength ?? 512, destScanCap);
        const expectedTargets = new Set<number>();
        const sourceEnd = Math.min(method.sourceOffset + bodyLength, source.length - 3);
        for (let pos = method.sourceOffset; pos < sourceEnd; pos += 4) {
          const sourceTarget = blTarget(source, pos);
          if (sourceTarget === null) continue;
          const resolvedTarget = resolvedBySource.get(sourceTarget);
          if (resolvedTarget) expectedTargets.add(resolvedTarget.destOffset);
        }
        if (expectedTargets.size > 0) {
          const fingerprintMatches = method.candidates.filter((candidate) => {
            const targets = collectBlTargets(destination, candidate, bodyLength);
            for (const expected of expectedTargets) if (!targets.has(expected)) return false;
            return true;
          });
          if (fingerprintMatches.length === 1) {
            const destOffset = fingerprintMatches[0];
            allNewlyResolved.set(method.name, destOffset);
            const newResolved: ResolvedMethod = {
              sourceOffset: method.sourceOffset,
              destOffset,
              sourceBodyLength: bodyLength,
            };
            resolvedList.push(newResolved);
            resolvedBySource.set(method.sourceOffset, newResolved);
            progress = true;
            continue;
          }
        }
      }

      const callerSourceOffsets = callerMap.get(method.sourceOffset);
      if (!callerSourceOffsets?.length) {
        stillPending.push(method);
        continue;
      }

      // Accumulate the intersection of candidate hits across all resolved callers.
      // intersection=null means "not yet started"; size=0 means "conflicted/no evidence".
      let intersection: Set<number> | null = null;
      let conflict = false;

      for (const callerSrc of callerSourceOffsets) {
        const caller = resolvedBySource.get(callerSrc);
        if (!caller) continue; // this caller isn't resolved yet — skip

        const destWindow = Math.min(caller.sourceBodyLength * 2, destScanCap);
        const destTargets = collectBlTargets(destination, caller.destOffset, destWindow);
        const hits = method.candidates.filter((c) => destTargets.has(c));

        if (hits.length === 0) continue; // BL to this method not visible in caller's dest window — skip

        if (intersection === null) {
          intersection = new Set(hits);
        } else {
          for (const c of intersection) {
            if (!destTargets.has(c)) intersection.delete(c);
          }
        }

        if (intersection.size === 0) {
          conflict = true;
          break;
        }
      }

      if (conflict || intersection === null || intersection.size !== 1) {
        stillPending.push(method);
        continue;
      }

      const [destOffset] = intersection;
      allNewlyResolved.set(method.name, destOffset);
      const newResolved: ResolvedMethod = {
        sourceOffset: method.sourceOffset,
        destOffset,
        // Newly xref-resolved methods may themselves be callers in the next iteration.
        // Use a conservative window since we don't know the true body length.
        sourceBodyLength: Math.min(512, source.length - method.sourceOffset),
      };
      resolvedList.push(newResolved);
      resolvedBySource.set(method.sourceOffset, newResolved);
      progress = true;
    }

    pending = stillPending;
    if (!progress) break;
  }

  return allNewlyResolved;
}
