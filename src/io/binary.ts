import { readFile } from 'node:fs/promises';

/** Read an ELF or binary library file into a Buffer. */
export async function readLib(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
