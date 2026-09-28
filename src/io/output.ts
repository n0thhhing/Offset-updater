import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface UpdatedOffset {
  name: string;
  offsets: number[];
  pattern: string;
}

export function formatOffset(offset: number): string {
  return `0x${offset.toString(16).toUpperCase()}`;
}

async function writeLines(file: string, lines: string[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, lines.join('\n') + (lines.length ? '\n' : ''));
}

export async function writeResults(
  offsetFile: string,
  signatureFile: string | undefined,
  results: UpdatedOffset[],
): Promise<void> {
  await Promise.all([
    writeLines(
      offsetFile,
      results.map((row) => `${row.offsets.map(formatOffset).join(' ')} -- ${row.name}`),
    ),
    signatureFile
      ? writeLines(
          signatureFile,
          results.map((row) => `${row.pattern} -- ${row.name}`),
        )
      : Promise.resolve(),
  ]);
}
