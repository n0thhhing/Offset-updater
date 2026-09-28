import { readFile } from 'node:fs/promises';

export interface OffsetEntry {
  offset: number;
  name: string;
}

export function parseOffsets(text: string): OffsetEntry[] {
  const entries: OffsetEntry[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('--')) continue;
    const match = line.match(/^(0x[\da-f]+)\s+--\s+(.+)$/i);
    if (!match)
      throw new Error(`Invalid offset at line ${index + 1}: expected "0x1234 -- method name"`);
    const offset = Number(match[1]);
    if (!Number.isSafeInteger(offset)) throw new Error(`Unsafe offset at line ${index + 1}`);
    entries.push({ offset, name: match[2].trim() });
  }
  if (!entries.length) throw new Error('The offset file contains no methods');
  return entries;
}

export async function readOffsets(file: string): Promise<OffsetEntry[]> {
  return parseOffsets(await readFile(file, 'utf8'));
}
