export function getHexFromOffset(
  buffer: Buffer,
  offset: number,
  length: number,
): Buffer {
  offset = typeof offset === 'string' ? parseInt(offset) : offset;
  const hexStr = buffer.toString('hex', offset, offset + length);
  return Buffer.from(hexStr, 'hex');
}
export function getStrHex(
  libraryData: LibData,
  offset: Offset,
  signatureLength: SignatureLength,
) {
  offset = typeof offset === 'string' ? parseInt(offset) : offset;
  const hexString = libraryData.toString(
    'hex',
    offset,
    offset + signatureLength,
  );

  return hexString.replace(/.{2}/g, '$& ');
}
