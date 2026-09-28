import type { PendingMethod, ResolvedMethod } from './xref';

export interface ElfSegment {
  file: number;
  va: bigint;
  fileSize: number;
  flags: number; // PF_X=1, PF_W=2, PF_R=4
}

export function parseSegments(data: Buffer): ElfSegment[] {
  if (
    data.length < 64 ||
    data[0] !== 0x7f ||
    data[1] !== 0x45 ||
    data[2] !== 0x4c ||
    data[3] !== 0x46 ||
    data[4] !== 2 ||
    data[5] !== 1
  )
    return [];
  const phoff = Number(data.readBigUInt64LE(32));
  const phentsize = data.readUInt16LE(54);
  const phnum = data.readUInt16LE(56);
  const segs: ElfSegment[] = [];
  for (let i = 0; i < phnum; i++) {
    const e = phoff + i * phentsize;
    if (e + phentsize > data.length) break;
    if (data.readUInt32LE(e) !== 1) continue; // PT_LOAD only
    segs.push({
      flags: data.readUInt32LE(e + 4),
      file: Number(data.readBigUInt64LE(e + 8)),
      va: data.readBigUInt64LE(e + 16),
      fileSize: Number(data.readBigUInt64LE(e + 32)),
    });
  }
  return segs;
}

export function fileToVA(segs: ElfSegment[], offset: number): bigint | null {
  for (const s of segs)
    if (offset >= s.file && offset < s.file + s.fileSize) return s.va + BigInt(offset - s.file);
  return null;
}

export function vaToFile(segs: ElfSegment[], va: bigint): number | null {
  for (const s of segs)
    if (va >= s.va && va < s.va + BigInt(s.fileSize)) return s.file + Number(va - s.va);
  return null;
}

/** How many vtable slots (×8 bytes each) to scan on each side looking for a resolved neighbor. */
const SCAN_RADIUS = 2048;

/**
 * Resolve ambiguous methods by tracking their position in C++ vtables.
 *
 * Virtual methods are stored as 64-bit function pointers in .rodata vtable arrays.
 * A method's vtable slot index is invariant across versions. By finding a uniquely-resolved
 * neighbor in the same vtable, we know exactly where the corresponding slot sits in the
 * destination vtable, and can read the new function pointer directly.
 *
 * Algorithm:
 *  1. Build a VA lookup map for all resolved methods (source VA → dest file offset).
 *  2. Scan source .rodata once; record every position that holds a pending or resolved method VA.
 *  3. Scan dest .rodata once; record every position that holds a resolved method's dest VA.
 *  4. For each pending method slot in source:
 *     a. Walk ±SCAN_RADIUS neighboring slots for any resolved neighbor.
 *     b. Look up where that neighbor's dest VA appears in destination .rodata.
 *     c. Offset by the same delta → the destination slot for the ambiguous method.
 *     d. Read the VA there, convert to file offset, check against candidates.
 *  5. If all evidence converges on a single candidate → resolved.
 *     Conflicts (different vtable contexts disagree) are conservatively rejected.
 */
export function vtableResolve(params: {
  source: Buffer;
  destination: Buffer;
  pending: PendingMethod[];
  resolved: ResolvedMethod[];
}): Map<string, number> {
  const { source, destination } = params;

  const srcSegs = parseSegments(source);
  const dstSegs = parseSegments(destination);
  // Non-executable PT_LOAD segments contain .rodata where vtables live
  const srcDataSegs = srcSegs.filter((s) => !(s.flags & 1));
  const dstDataSegs = dstSegs.filter((s) => !(s.flags & 1));

  // source VA → dest file offset (for all resolved methods)
  const resolvedSrcVAMap = new Map<bigint, number>();
  // dest file offset → dest VA (cached)
  const resolvedDstVAMap = new Map<number, bigint>();
  for (const r of params.resolved) {
    const sva = fileToVA(srcSegs, r.sourceOffset);
    const dva = fileToVA(dstSegs, r.destOffset);
    if (sva !== null) resolvedSrcVAMap.set(sva, r.destOffset);
    if (dva !== null) resolvedDstVAMap.set(r.destOffset, dva);
  }

  // pending: source VA → { method, candidate file offsets }
  const pendingSrcVAMap = new Map<bigint, { method: PendingMethod; candidates: Set<number> }>();
  for (const m of params.pending) {
    const va = fileToVA(srcSegs, m.sourceOffset);
    if (va !== null) pendingSrcVAMap.set(va, { method: m, candidates: new Set(m.candidates) });
  }

  // Set of all VAs we care about in source .rodata (pending + resolved)
  const interestingSrcVAs = new Set<bigint>([
    ...pendingSrcVAMap.keys(),
    ...resolvedSrcVAMap.keys(),
  ]);
  // Set of dest VAs we care about in dest .rodata (resolved methods' destinations)
  const interestingDstVAs = new Set<bigint>(resolvedDstVAMap.values());

  // --- Single pass over source .rodata ---
  // file offset → VA (only for interesting entries)
  const srcVASlots = new Map<number, bigint>();
  for (const seg of srcDataSegs) {
    const end = Math.min(seg.file + seg.fileSize - 7, source.length - 7);
    for (let pos = seg.file; pos <= end; pos += 8) {
      const va = source.readBigUInt64LE(pos);
      if (va !== 0n && interestingSrcVAs.has(va)) srcVASlots.set(pos, va);
    }
  }

  // --- Single pass over dest .rodata ---
  // dest VA → list of file offsets where it appears
  const dstVAToSlots = new Map<bigint, number[]>();
  for (const seg of dstDataSegs) {
    const end = Math.min(seg.file + seg.fileSize - 7, destination.length - 7);
    for (let pos = seg.file; pos <= end; pos += 8) {
      const va = destination.readBigUInt64LE(pos);
      if (va !== 0n && interestingDstVAs.has(va)) {
        let list = dstVAToSlots.get(va);
        if (!list) dstVAToSlots.set(va, (list = []));
        list.push(pos);
      }
    }
  }

  // --- Vtable resolution ---
  // name -> map of (destCandOffset -> votes)
  const votes = new Map<string, Map<number, number>>();
  const independentNeighbors = new Map<string, Map<number, Set<bigint>>>();

  for (const [slotFile, slotVA] of srcVASlots) {
    const entry = pendingSrcVAMap.get(slotVA);
    if (!entry) continue; // slot belongs to a resolved method, not a pending one
    const { method, candidates } = entry;

    let methodVotes = votes.get(method.name);
    if (!methodVotes) {
      methodVotes = new Map<number, number>();
      votes.set(method.name, methodVotes);
    }

    // Scan neighbors for a resolved method at a known relative offset
    for (let delta = -SCAN_RADIUS; delta <= SCAN_RADIUS; delta++) {
      if (delta === 0) continue;
      const neighborSrcFile = slotFile + delta * 8;
      const neighborSrcVA = srcVASlots.get(neighborSrcFile);
      if (neighborSrcVA === undefined) continue;

      const neighborDstFile = resolvedSrcVAMap.get(neighborSrcVA);
      if (neighborDstFile === undefined) continue;

      const neighborDstVA = resolvedDstVAMap.get(neighborDstFile);
      if (neighborDstVA === undefined) continue;

      // Find where this neighbor's dest VA appears in destination .rodata
      const dstNeighborSlots = dstVAToSlots.get(neighborDstVA);
      if (!dstNeighborSlots) continue;

      for (const dstNeighborFile of dstNeighborSlots) {
        // The ambiguous method sits at -delta slots relative to this neighbor in dest
        const dstCandFile = dstNeighborFile - delta * 8;
        if (dstCandFile < 0 || dstCandFile + 8 > destination.length) continue;

        const dstCandVA = destination.readBigUInt64LE(dstCandFile);
        if (dstCandVA === 0n) continue;

        const dstCandOffset = vaToFile(dstSegs, dstCandVA);
        if (dstCandOffset === null) continue;
        if (candidates.size > 0 && !candidates.has(dstCandOffset)) continue;

        methodVotes.set(
          dstCandOffset,
          (methodVotes.get(dstCandOffset) || 0) + 1.0 / Math.abs(delta),
        );
        let byCandidate = independentNeighbors.get(method.name);
        if (!byCandidate) independentNeighbors.set(method.name, (byCandidate = new Map()));
        let neighbors = byCandidate.get(dstCandOffset);
        if (!neighbors) byCandidate.set(dstCandOffset, (neighbors = new Set()));
        neighbors.add(neighborSrcVA);
      }
    }
  }

  const final = new Map<string, number>();
  for (const [name, methodVotes] of votes.entries()) {
    if (methodVotes.size === 0) continue;

    // Find the candidate with the maximum votes
    let maxVotes = 0;
    let bestCand = -1;
    let tie = false;

    for (const [cand, count] of methodVotes.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        bestCand = cand;
        tie = false;
      } else if (count === maxVotes) {
        tie = true;
      }
    }

    let totalVotes = 0;
    for (const count of methodVotes.values()) totalVotes += count;

    // If we had no byte candidates, we require strong consensus from the .rodata array
    // At least 2.0 total weight (e.g. at least two immediate neighbors), and > 75% of all votes cast.

    const pendingMethod = params.pending.find((m) => m.name === name);
    const hasNoCandidates = pendingMethod ? pendingMethod.candidates.length === 0 : false;
    if (hasNoCandidates) {
      const support = independentNeighbors.get(name)?.get(bestCand)?.size ?? 0;
      if (!tie && support >= 2 && maxVotes >= 0.1 && maxVotes / totalVotes >= 0.8) {
        final.set(name, bestCand);
      }
    } else {
      if (!tie) final.set(name, bestCand);
    }
  }

  return final;
}
