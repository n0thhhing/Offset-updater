// Only resolve direct B instructions. Calls, indirect branches, and multi-hop detours are not accepted.

/** Shared ELF VA↔file-offset translation for ARM64 branch displacement. */
function resolveFileTarget(data: Buffer, instrOffset: number, displacement: number): number | null {
  if (
    data.length >= 64 &&
    data.subarray(0, 6).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1]))
  ) {
    const table = Number(data.readBigUInt64LE(32));
    const size = data.readUInt16LE(54),
      count = data.readUInt16LE(56);
    if (!Number.isSafeInteger(table) || size < 56 || table + size * count > data.length)
      return null;
    const segments: { file: number; va: number; length: number }[] = [];
    for (let i = 0; i < count; i++) {
      const entry = table + i * size;
      if (data.readUInt32LE(entry) !== 1 || !(data.readUInt32LE(entry + 4) & 1)) continue;
      const file = Number(data.readBigUInt64LE(entry + 8));
      const va = Number(data.readBigUInt64LE(entry + 16));
      const length = Number(data.readBigUInt64LE(entry + 32));
      if (![file, va, length].every(Number.isSafeInteger) || file + length > data.length)
        return null;
      segments.push({ file, va, length });
    }
    const source = segments.find(
      (s) => instrOffset >= s.file && instrOffset + 4 <= s.file + s.length,
    );
    if (!source) return null;
    const targetVA = source.va + instrOffset - source.file + displacement;
    const target = segments.find((s) => targetVA >= s.va && targetVA + 4 <= s.va + s.length);
    return target ? target.file + targetVA - target.va : null;
  }
  const target = instrOffset + displacement;
  return target >= 0 && target + 4 <= data.length ? target : null;
}

/** Decode a direct unconditional branch (B) and return its file offset target, or null. */
export function branchTarget(data: Buffer, offset: number): number | null {
  if (offset < 0 || offset + 4 > data.length || offset % 4) return null;
  const word = data.readUInt32LE(offset);
  if ((word & 0xfc000000) !== 0x14000000) return null;
  const displacement = ((word << 6) >> 6) * 4;
  return resolveFileTarget(data, offset, displacement);
}

/** Decode a branch-with-link (BL) call and return its file offset target, or null. */
export function blTarget(data: Buffer, offset: number): number | null {
  if (offset < 0 || offset + 4 > data.length || offset % 4) return null;
  const word = data.readUInt32LE(offset);
  if ((word & 0xfc000000) >>> 0 !== 0x94000000) return null;
  const displacement = ((word << 6) >> 6) * 4;
  return resolveFileTarget(data, offset, displacement);
}
