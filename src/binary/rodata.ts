import { scan } from '../patterns/scan';
import { type PendingMethod } from './xref';
import { vaToFile, fileToVA, parseSegments } from './vtable';
import { nativePointerIndex } from './native-analysis';

export function rodataResolve(params: {
  source: Buffer;
  destination: Buffer;
  pending: PendingMethod[];
}): Map<string, number> {
  const { source, destination, pending } = params;
  const srcSegs = parseSegments(source);
  const dstSegs = parseSegments(destination);
  const resolved = new Map<string, number>();
  const neighborMatchCache = new Map<number, number | null>();
  const destinationPointerCache = new Map<bigint, number[]>();
  const sourceVAs = pending
    .map((method) => fileToVA(srcSegs, method.sourceOffset))
    .filter((value): value is bigint => value !== null);
  const sourcePointerIndex = nativePointerIndex(source, sourceVAs);

  for (const m of pending) {
    const va = fileToVA(srcSegs, m.sourceOffset);
    if (va === null) continue;
    const vaBig = BigInt(va);
    const vaBuf = Buffer.allocUnsafe(8);
    vaBuf.writeBigUInt64LE(vaBig);

    const ptrs = sourcePointerIndex?.get(vaBig) ?? [];
    if (!sourcePointerIndex) {
      let pos = 0;
      while ((pos = source.indexOf(vaBuf, pos)) !== -1) {
        if (pos % 8 === 0) ptrs.push(pos);
        pos += 8;
      }
    }

    let foundNewOffset = false;
    for (const ptr of ptrs) {
      if (foundNewOffset) break;

      // Pointer density check: Ensure this is actually an array of pointers (like g_MethodPointers)
      let validPointers = 0;
      for (let j = -4; j <= 4; j++) {
        if (j === 0) continue;
        const testPtr = ptr + j * 8;
        if (testPtr < 0 || testPtr >= source.length - 8) continue;
        const testVa = source.readBigUInt64LE(testPtr);
        const testOff = vaToFile(srcSegs, testVa);
        // Valid if it points to a reasonable offset (e.g. within .text)
        if (testOff !== null && testOff > 0x10000 && testOff < source.length) {
          validPointers++;
        }
      }

      // We expect at least 6 out of 8 neighbors to be valid pointers
      if (validPointers < 6) continue;

      const prevVa = source.readBigUInt64LE(ptr - 8);
      const nextVa = source.readBigUInt64LE(ptr + 8);

      const neighbors = [
        { origVa: prevVa, dir: -1 },
        { origVa: nextVa, dir: 1 },
      ];

      for (const neighbor of neighbors) {
        if (foundNewOffset) break;

        const nOff = vaToFile(srcSegs, neighbor.origVa);
        if (nOff === null || nOff < 0 || nOff >= source.length) continue;

        let matchedNeighbor = neighborMatchCache.get(nOff);
        if (matchedNeighbor === undefined) {
          const pattern =
            source
              .subarray(nOff, nOff + 64)
              .toString('hex')
              .match(/../g)
              ?.join(' ') ?? '';
          const matches = scan(pattern, destination);
          matchedNeighbor = matches.length === 1 ? matches[0] : null;
          neighborMatchCache.set(nOff, matchedNeighbor);
        }

        if (matchedNeighbor !== null) {
          const newNeighborVa = fileToVA(dstSegs, matchedNeighbor);
          if (newNeighborVa === null) continue;
          const newNeighborVaBig = BigInt(newNeighborVa);
          let destinationSlots = destinationPointerCache.get(newNeighborVaBig);
          if (!destinationSlots) {
            destinationSlots = [];
            const newNeighborVaBuf = Buffer.allocUnsafe(8);
            newNeighborVaBuf.writeBigUInt64LE(newNeighborVaBig);
            let position = 0;
            while ((position = destination.indexOf(newNeighborVaBuf, position)) !== -1) {
              if (position % 8 === 0) destinationSlots.push(position);
              position += 8;
            }
            destinationPointerCache.set(newNeighborVaBig, destinationSlots);
          }

          for (const j of destinationSlots) {
            if (j % 8 !== 0) {
              continue;
            }

            let validNewPointers = 0;
            for (let k = -4; k <= 4; k++) {
              if (k === 0) continue;
              const testPtr = j + k * 8;
              if (testPtr < 0 || testPtr >= destination.length - 8) continue;
              const testVa = destination.readBigUInt64LE(testPtr);
              const testOff = vaToFile(dstSegs, testVa);
              if (testOff !== null && testOff > 0x10000 && testOff < destination.length) {
                validNewPointers++;
              }
            }
            if (validNewPointers < 6) {
              continue;
            }

            const targetPtr = j - neighbor.dir * 8;
            if (targetPtr >= 0 && targetPtr < destination.length - 8) {
              const newTargetVa = destination.readBigUInt64LE(targetPtr);
              const newTargetOff = vaToFile(dstSegs, newTargetVa);
              if (newTargetOff !== null) {
                resolved.set(m.name, newTargetOff);
                foundNewOffset = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  return resolved;
}
