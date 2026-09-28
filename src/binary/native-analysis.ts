import fs from 'node:fs';
import path from 'node:path';

let symbols: any;
let pointer: any;
try {
  // @ts-ignore Bun-only optional acceleration.
  if (typeof Bun !== 'undefined') {
    const { dlopen, FFIType, ptr } = await import('bun:ffi');
    const library = path.resolve(import.meta.dir, '..', '..', 'native', 'libcore.dylib');
    if (fs.existsSync(library)) {
      symbols = dlopen(library, {
        index_u64_values: {
          args: [
            FFIType.ptr,
            FFIType.u64,
            FFIType.ptr,
            FFIType.u32,
            FFIType.ptr,
            FFIType.ptr,
            FFIType.u32,
          ],
          returns: FFIType.void,
        },
        extract_bl_targets: {
          args: [
            FFIType.ptr,
            FFIType.u64,
            FFIType.ptr,
            FFIType.ptr,
            FFIType.u32,
            FFIType.ptr,
            FFIType.ptr,
            FFIType.u32,
          ],
          returns: FFIType.void,
        },
        filter_control_flow: {
          args: [
            FFIType.ptr,
            FFIType.u64,
            FFIType.u32,
            FFIType.ptr,
            FFIType.u64,
            FFIType.ptr,
            FFIType.u32,
            FFIType.u32,
          ],
          returns: FFIType.u32,
        },
      }).symbols;
      pointer = ptr;
    }
  }
} catch {
  symbols = undefined;
}

export function nativePointerIndex(
  data: Buffer,
  values: bigint[],
): Map<bigint, number[]> | undefined {
  if (!symbols || values.length === 0) return undefined;
  const input = new BigUint64Array(values);
  const capacity = 4096,
    counts = new Uint32Array(values.length),
    offsets = new Uint32Array(values.length * capacity);
  symbols.index_u64_values(
    pointer(data),
    BigInt(data.length),
    pointer(input),
    values.length,
    pointer(counts),
    pointer(offsets),
    capacity,
  );
  const result = new Map<bigint, number[]>();
  for (let i = 0; i < values.length; i++) {
    if (counts[i] > capacity) return undefined;
    result.set(values[i], Array.from(offsets.subarray(i * capacity, i * capacity + counts[i])));
  }
  return result;
}

export function nativeCallTargets(
  data: Buffer,
  ranges: { start: number; length: number }[],
): Set<number>[] | undefined {
  if (!symbols || ranges.length === 0) return undefined;
  const starts = new Uint32Array(ranges.map((r) => r.start)),
    windows = new Uint32Array(ranges.map((r) => r.length));
  const capacity = 512,
    counts = new Uint32Array(ranges.length),
    targets = new Uint32Array(ranges.length * capacity);
  symbols.extract_bl_targets(
    pointer(data),
    BigInt(data.length),
    pointer(starts),
    pointer(windows),
    ranges.length,
    pointer(counts),
    pointer(targets),
    capacity,
  );
  if ([...counts].some((count) => count > capacity)) return undefined;
  return ranges.map((_, i) => new Set(targets.subarray(i * capacity, i * capacity + counts[i])));
}

export function nativeControlFlowFilter(
  source: Buffer,
  sourceOffset: number,
  destination: Buffer,
  candidates: number[],
  length: number,
): number[] | undefined {
  if (!symbols || candidates.length === 0) return undefined;
  const values = new Uint32Array(candidates);
  const count = symbols.filter_control_flow(
    pointer(source),
    BigInt(source.length),
    sourceOffset,
    pointer(destination),
    BigInt(destination.length),
    pointer(values),
    values.length,
    length,
  );
  return Array.from(values.subarray(0, count));
}
