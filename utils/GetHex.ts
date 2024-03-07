import fs from 'fs';
import { color } from './';

export function getHexFromOffset(
  buffer: LibData,
  offset: number,
  length: SignatureLength,
): Buffer {
  offset = typeof offset === 'string' ? parseInt(offset) : offset;
  const hexStr: string = buffer.toString('hex', offset, offset + length);
  return Buffer.from(hexStr, 'hex');
}

export function getStrHex(
  libraryData: LibData,
  offset: LibOffset,
  signatureLength: SignatureLength,
) {
  offset = typeof offset === 'string' ? parseInt(offset) : offset;
  const hexString: string = libraryData.toString(
    'hex', // @ts-ignore
    offset,
    offset + signatureLength,
  );

  return hexString.replace(/.{2}/g, '$& ');
}

export async function readHex(filePath: FilePath): Promise<Hex> {
  const start = Bun.nanoseconds();
  const data: Buffer = await fs.promises.readFile(filePath);
  const hexString: Hex = data.toString('hex');
  console.log(
    color.Grey(
      `readHex(${filePath}): ${color.Blue((Bun.nanoseconds() - start) / 1_000_000)}ms`,
    ),
  );
  return hexString;
}
