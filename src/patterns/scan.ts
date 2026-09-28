import path from 'path';
import fs from 'fs';

export type Pattern = string;

// ---------------------------------------------------------------------------
// Native C++ ARM NEON Multi-Threaded Engine (via bun:ffi)
// ---------------------------------------------------------------------------

let nativeScannerStr: any = null;
let nativeBatchScanner: any = null;
let nativePtr: any = null;
let nativeOutBuffer: Uint32Array | null = null;
const MAX_MATCHES = 4096;

let nativePatternScratch: Buffer | null = null;

try {
  // Only attempt to load under Bun runtime
  // @ts-ignore
  if (typeof Bun !== 'undefined') {
    const { dlopen, FFIType, ptr } = await import('bun:ffi');
    const dylibPath = path.resolve(import.meta.dir, '..', '..', 'native', 'libcore.dylib');

    if (fs.existsSync(dylibPath)) {
      const lib = dlopen(dylibPath, {
        scan_str_mt: {
          args: [
            FFIType.ptr, // data
            FFIType.u64, // data_len
            FFIType.ptr, // pattern_str
            FFIType.u64, // pattern_str_len
            FFIType.ptr, // out_offsets
            FFIType.u32, // max_out
          ],
          returns: FFIType.u32,
        },

        filter_matches: {
          args: [
            FFIType.ptr, // data
            FFIType.u64, // data_len
            FFIType.ptr, // inout_offsets
            FFIType.u32, // offsets_count
            FFIType.ptr, // pattern_str
            FFIType.u64, // pattern_str_len
            FFIType.u64, // check_start
          ],
          returns: FFIType.u32,
        },
        batch_scan: {
          args: [
            FFIType.ptr,
            FFIType.u64,
            FFIType.ptr,
            FFIType.u64,
            FFIType.u32,
            FFIType.ptr,
            FFIType.ptr,
            FFIType.u32,
          ],
          returns: FFIType.void,
        },
      });

      nativeScannerStr = lib.symbols.scan_str_mt;
      nativeBatchScanner = lib.symbols.batch_scan;
      (globalThis as any).nativeFilterMatchesStr = lib.symbols.filter_matches;

      nativePtr = ptr;
      nativeOutBuffer = new Uint32Array(MAX_MATCHES);
      nativePatternScratch = Buffer.alloc(2048);
    }
  }
} catch {
  nativeScannerStr = null;
  nativeBatchScanner = null;
  (globalThis as any).nativeFilterMatchesStr = null;
}

const elfBoundsCache = new WeakMap<Uint8Array, { start: number; end: number } | null>();

function getElfCodeBounds(buf: Buffer): { start: number; end: number } | null {
  const cached = elfBoundsCache.get(buf);
  if (cached !== undefined) return cached;

  if (
    buf.length < 64 ||
    buf[0] !== 0x7f ||
    buf[1] !== 0x45 ||
    buf[2] !== 0x4c ||
    buf[3] !== 0x46 ||
    buf[4] !== 2 // 64-bit ELF
  ) {
    elfBoundsCache.set(buf, null);
    return null;
  }
  const shoff = Number(buf.readBigUInt64LE(40));
  const shentsize = buf.readUInt16LE(58);
  const shnum = buf.readUInt16LE(60);
  if (shoff === 0 || shnum === 0 || shentsize < 64) {
    elfBoundsCache.set(buf, null);
    return null;
  }

  let minOffset = Infinity;
  let maxOffset = 0;
  for (let i = 0; i < shnum; i++) {
    const entry = shoff + i * shentsize;
    if (entry + 64 > buf.length) break;
    const flags = Number(buf.readBigUInt64LE(entry + 8));
    if ((flags & 0x4) !== 0) {
      // SHF_EXECINSTR
      const offset = Number(buf.readBigUInt64LE(entry + 24));
      const size = Number(buf.readBigUInt64LE(entry + 32));
      if (offset < minOffset) minOffset = offset;
      if (offset + size > maxOffset) maxOffset = offset + size;
    }
  }
  if (minOffset === Infinity || minOffset >= maxOffset) {
    elfBoundsCache.set(buf, null);
    return null;
  }
  const bounds = { start: minOffset, end: maxOffset };
  elfBoundsCache.set(buf, bounds);
  return bounds;
}

/**
 * Super fast byte-pattern scanner.
 * Uses the native ARM NEON SIMD engine when available,
 * and gracefully falls back to the pure JS Buffer scanner.
 */
function scanUncached(patternStr: Pattern, data: Buffer | Uint8Array | string): number[] {
  const dataBuf = Buffer.isBuffer(data)
    ? data
    : typeof data === 'string'
      ? Buffer.from(data, 'hex')
      : Buffer.from(data.buffer, data.byteOffset, data.byteLength);

  // 1. Ultra-fast native path: Pass pattern directly to C++
  const isShortPattern = patternStr.length <= 1536 || patternStr.replace(/\s+/g, '').length <= 1024;
  if (nativeScannerStr && nativeOutBuffer && isShortPattern && dataBuf.length > 0) {
    try {
      const ptr = nativePtr;
      let patternBuf: Buffer;
      let patternByteLen: number;

      if (nativePatternScratch && patternStr.length < 2048) {
        patternByteLen = nativePatternScratch.write(patternStr, 0, 'utf8');
        patternBuf = nativePatternScratch;
      } else {
        patternBuf = Buffer.from(patternStr, 'utf8');
        patternByteLen = patternBuf.length;
      }

      const bounds = getElfCodeBounds(dataBuf);
      const targetBuf = bounds ? dataBuf.subarray(bounds.start, bounds.end) : dataBuf;
      const baseOffset = bounds ? bounds.start : 0;

      let count: number = nativeScannerStr(
        ptr(targetBuf),
        BigInt(targetBuf.length),
        ptr(patternBuf),
        BigInt(patternByteLen),
        ptr(nativeOutBuffer),
        MAX_MATCHES,
      );

      // If pattern was not found in the code section of an ELF binary, fall back to scanning full binary
      if (count === 0 && bounds) {
        count = nativeScannerStr(
          ptr(dataBuf),
          BigInt(dataBuf.length),
          ptr(patternBuf),
          BigInt(patternByteLen),
          ptr(nativeOutBuffer),
          MAX_MATCHES,
        );
        if (count > MAX_MATCHES) throw new Error('Native result capacity exceeded');
        if (count === 0) return [];
        if (count === 1) return [nativeOutBuffer[0]];
        const res: number[] = new Array(count);
        for (let i = 0; i < count; i++) res[i] = nativeOutBuffer[i];
        return res;
      }

      // The native ABI reports the total, including entries beyond its output capacity.
      if (count > MAX_MATCHES) throw new Error('Native result capacity exceeded');
      if (count === 0) return [];
      if (count === 1) return [nativeOutBuffer[0] + baseOffset];
      const res: number[] = new Array(count);
      for (let i = 0; i < count; i++) {
        res[i] = nativeOutBuffer[i] + baseOffset;
      }
      return res;
    } catch {
      // Fall through to JS fallback if FFI fails
    }
  }

  // 2. Pure JS Buffer fallback
  const parts = patternStr.replace(/\s+/g, '').match(/.{2}/g) || [];
  const len = parts.length;
  if (len === 0) return [];

  const values = new Uint8Array(len);
  const masks = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    const p = parts[i];
    if (p === '??') {
      masks[i] = 0x00;
      values[i] = 0x00;
    } else if (p[0] === '?') {
      masks[i] = 0x0f;
      values[i] = parseInt(p[1], 16);
    } else if (p[1] === '?') {
      masks[i] = 0xf0;
      values[i] = parseInt(p[0], 16) << 4;
    } else {
      masks[i] = 0xff;
      values[i] = parseInt(p, 16);
    }
  }

  let bestStart = -1;
  let bestLen = 0;
  let currentStart = -1;
  let currentLen = 0;

  for (let i = 0; i < len; i++) {
    if (masks[i] === 0xff) {
      if (currentStart === -1) currentStart = i;
      currentLen++;
    } else {
      if (currentLen > bestLen) {
        bestLen = currentLen;
        bestStart = currentStart;
      }
      currentStart = -1;
      currentLen = 0;
    }
  }
  if (currentLen > bestLen) {
    bestLen = currentLen;
    bestStart = currentStart;
  }

  const results: number[] = [];

  if (bestLen === 0) {
    for (let i = 0; i <= dataBuf.length - len; i++) {
      let match = true;
      for (let j = 0; j < len; j++) {
        if ((dataBuf[i + j] & masks[j]) !== values[j]) {
          match = false;
          break;
        }
      }
      if (match) results.push(i);
    }
    return results;
  }

  const searchBuffer = Buffer.from(values.buffer, values.byteOffset + bestStart, bestLen);
  let searchIdx = bestStart;
  const maxSearch = dataBuf.length - len + bestStart;

  while (searchIdx <= maxSearch) {
    const foundIdx = dataBuf.indexOf(searchBuffer, searchIdx);
    if (foundIdx === -1 || foundIdx > maxSearch) break;

    const startIdx = foundIdx - bestStart;

    let isMatch = true;
    for (let i = 0; i < len; i++) {
      if ((dataBuf[startIdx + i] & masks[i]) !== values[i]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      results.push(startIdx);
    }
    searchIdx = foundIdx + 1;
  }

  return results;
}

const scanCache = new WeakMap<Uint8Array, Map<string, number[]>>();

function scan(patternStr: Pattern, data: Buffer | Uint8Array | string): number[] {
  if (typeof data === 'string') return scanUncached(patternStr, data);
  let cache = scanCache.get(data);
  if (!cache) {
    cache = new Map();
    scanCache.set(data, cache);
  }
  const cached = cache.get(patternStr);
  if (cached) return cached;
  const result = scanUncached(patternStr, data);
  cache.set(patternStr, result);
  return result;
}

export { scan };

/** Scan many short signatures in one pass over the executable section. */
export function batchScan(patterns: Pattern[], data: Buffer): (number[] | undefined)[] {
  if (
    process.env.OFFSET_UPDATER_DISABLE_BATCH === '1' ||
    !nativeBatchScanner ||
    !nativePtr ||
    patterns.length === 0 ||
    patterns.length > 0xffff
  ) {
    return patterns.map(() => undefined);
  }
  const encoded: Buffer[] = [];
  for (let id = 0; id < patterns.length; id++) {
    const parts = patterns[id].replace(/\s+/g, '').match(/.{2}/g) ?? [];
    if (!parts.length || parts.length > 0xffff) return patterns.map(() => undefined);
    const header = Buffer.allocUnsafe(4);
    header.writeUInt16LE(id, 0);
    header.writeUInt16LE(parts.length, 2);
    const values = Buffer.allocUnsafe(parts.length);
    const masks = Buffer.allocUnsafe(parts.length);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      values[i] = parseInt(part.replace(/\?/g, '0'), 16);
      masks[i] = (part[0] === '?' ? 0 : 0xf0) | (part[1] === '?' ? 0 : 0x0f);
    }
    encoded.push(header, values, masks);
  }
  const patternBuffer = Buffer.concat(encoded);
  const bounds = getElfCodeBounds(data);
  const target = bounds ? data.subarray(bounds.start, bounds.end) : data;
  const base = bounds?.start ?? 0;
  const maxMatches = 256;
  const counts = new Uint32Array(patterns.length);
  const offsets = new Uint32Array(patterns.length * maxMatches);
  try {
    nativeBatchScanner(
      nativePtr(target),
      BigInt(target.length),
      nativePtr(patternBuffer),
      BigInt(patternBuffer.length),
      patterns.length,
      nativePtr(counts),
      nativePtr(offsets),
      maxMatches,
    );
  } catch {
    return patterns.map(() => undefined);
  }
  return patterns.map((_, id) => {
    const count = counts[id];
    // Let the regular scanner handle misses (including the full-ELF fallback)
    // and unusually broad signatures whose complete result would exceed capacity.
    if (count === 0 || count > maxMatches) return undefined;
    const result = new Array<number>(count);
    for (let i = 0; i < count; i++) result[i] = offsets[id * maxMatches + i] + base;
    return result;
  });
}

export function filterMatches(
  data: Buffer | Uint8Array,
  offsets: number[],
  patternStr: Pattern,
  checkStart: number,
): number[] {
  if (offsets.length === 0) return offsets;
  const dataBuf = Buffer.isBuffer(data)
    ? data
    : Buffer.from(data.buffer, data.byteOffset, data.byteLength);

  const nativeFilter = (globalThis as any).nativeFilterMatchesStr;
  if (nativeFilter && typeof nativePtr !== 'undefined') {
    try {
      const ptr = nativePtr;
      let patternBuf: Buffer;
      let patternByteLen: number;

      if (nativePatternScratch && patternStr.length < 2048) {
        patternByteLen = nativePatternScratch.write(patternStr, 0, 'utf8');
        patternBuf = nativePatternScratch;
      } else {
        patternBuf = Buffer.from(patternStr, 'utf8');
        patternByteLen = patternBuf.length;
      }

      // Convert JS array to typed array for native inplace update
      const typedOffsets = new Uint32Array(offsets);

      const count: number = nativeFilter(
        ptr(dataBuf),
        BigInt(dataBuf.length),
        ptr(typedOffsets),
        offsets.length,
        ptr(patternBuf),
        BigInt(patternByteLen),
        BigInt(checkStart),
      );

      if (count === 0) return [];
      if (count === offsets.length) return offsets;
      return Array.from(typedOffsets.subarray(0, count));
    } catch {
      // Fall through
    }
  }

  // JS Fallback
  const parts = patternStr.replace(/\s+/g, '').match(/.{2}/g) || [];
  const len = parts.length;
  if (len === 0 || checkStart >= len) return offsets;

  const values = new Uint8Array(len);
  const masks = new Uint8Array(len);

  for (let i = checkStart; i < len; i++) {
    const p = parts[i];
    if (p === '??') {
      masks[i] = 0x00;
      values[i] = 0x00;
    } else if (p[0] === '?') {
      masks[i] = 0x0f;
      values[i] = parseInt(p[1], 16);
    } else if (p[1] === '?') {
      masks[i] = 0xf0;
      values[i] = parseInt(p[0], 16) << 4;
    } else {
      masks[i] = 0xff;
      values[i] = parseInt(p, 16);
    }
  }

  return offsets.filter((start) => {
    if (start + len > dataBuf.length) return false;
    for (let i = checkStart; i < len; i++) {
      if ((dataBuf[start + i] & masks[i]) !== values[i]) return false;
    }
    return true;
  });
}
