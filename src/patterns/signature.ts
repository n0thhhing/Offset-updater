import { maskInstruction } from './wildcards';
import type { Disassembler } from '../disassembler';
import { scan, filterMatches } from './scan';

export type Offset = number | string;
export type SignatureLength = number;

/**
 * Generates a byte-spaced hex pattern for the instructions starting at `offset`.
 */
async function getPattern(
  disassembler: Disassembler,
  buffer: Buffer,
  offset: Offset,
  len: SignatureLength,
  masker: typeof maskInstruction = maskInstruction,
): Promise<string> {
  const hex: Buffer = buffer.subarray(Number(offset), Number(offset) + len);
  const instructions = disassembler.disasm(hex, offset as number);

  const parts: string[] = [];
  for (let i = 0; i < instructions.length; i++) {
    const m8 = masker(instructions[i]);
    parts.push(m8.slice(0, 2), m8.slice(2, 4), m8.slice(4, 6), m8.slice(6, 8));
  }

  return parts.join(' ');
}

/** Grow signatures by filtering prior matches instead of rescanning the library. */
async function getUniquePattern(
  disassembler: Disassembler,
  buffer: Buffer,
  fullBuffer: Buffer | string,
  offset: number,
  maxLength: number,
): Promise<{ pattern: string; length: number; matches: number[] }> {
  const data = typeof fullBuffer === 'string' ? Buffer.from(fullBuffer, 'hex') : fullBuffer;
  const available = Math.min(maxLength, buffer.length - offset);
  const firstLength = Math.min(48, Math.floor(available / 4) * 4);
  if (firstLength <= 0) return { pattern: '', length: 0, matches: [] };

  const hex: Buffer = buffer.subarray(offset, offset + firstLength);
  const instructions = disassembler.disasm(hex, offset);
  const parts: string[] = [];
  for (let i = 0; i < instructions.length; i++) {
    const m8 = maskInstruction(instructions[i]);
    parts.push(m8.slice(0, 2), m8.slice(2, 4), m8.slice(4, 6), m8.slice(6, 8));
  }

  let length = parts.length;
  if (length === 0) return { pattern: '', length: 0, matches: [] };
  let pattern = parts.join(' ');
  let matches = scan(pattern, data);

  // Most methods are unique at 48 bytes. Decode the tail in chunks only when necessary.
  if (
    (matches.length === 1 && matches[0] === offset) ||
    length < firstLength ||
    length >= available
  ) {
    return { pattern, length, matches };
  }

  const values: number[] = new Array(parts.length);
  const masks: number[] = new Array(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    values[i] = parseInt(p.replace(/\?/g, '0'), 16);
    masks[i] = (p[0] === '?' ? 0 : 0xf0) | (p[1] === '?' ? 0 : 0x0f);
  }

  while (length < available && !(matches.length === 1 && matches[0] === offset)) {
    const chunkLen = Math.min(48, available - length);
    const chunkHex = buffer.subarray(offset + length, offset + length + chunkLen);
    const chunkInstrs = disassembler.disasm(chunkHex, offset + length);
    if (!chunkInstrs || chunkInstrs.length === 0) break;

    const prevPartsLen = parts.length;
    for (let j = 0; j < chunkInstrs.length; j++) {
      const m8 = maskInstruction(chunkInstrs[j]);
      const p0 = m8.slice(0, 2),
        p1 = m8.slice(2, 4),
        p2 = m8.slice(4, 6),
        p3 = m8.slice(6, 8);
      parts.push(p0, p1, p2, p3);
      values.push(
        parseInt(p0.replace(/\?/g, '0'), 16),
        parseInt(p1.replace(/\?/g, '0'), 16),
        parseInt(p2.replace(/\?/g, '0'), 16),
        parseInt(p3.replace(/\?/g, '0'), 16),
      );
      masks.push(
        (p0[0] === '?' ? 0 : 0xf0) | (p0[1] === '?' ? 0 : 0x0f),
        (p1[0] === '?' ? 0 : 0xf0) | (p1[1] === '?' ? 0 : 0x0f),
        (p2[0] === '?' ? 0 : 0xf0) | (p2[1] === '?' ? 0 : 0x0f),
        (p3[0] === '?' ? 0 : 0xf0) | (p3[1] === '?' ? 0 : 0x0f),
      );
    }

    const limit = Math.min(parts.length, Math.floor(available / 4) * 4);
    while (length < limit && !(matches.length === 1 && matches[0] === offset)) {
      const nextLength = Math.min(length + 12, limit);
      const nextPattern = parts.slice(0, nextLength).join(' ');
      matches = filterMatches(data, matches, nextPattern, length);
      length = nextLength;
    }

    if (parts.length === prevPartsLen) break;
  }

  pattern = parts.slice(0, length).join(' ');
  return { pattern, length, matches };
}

export { getPattern, getUniquePattern };
