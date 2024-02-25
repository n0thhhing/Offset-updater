export function getHexFromOffset(
  buffer: LibData,
  offset: number,
  length: SignatureLength,
): Buffer {
  offset = typeof offset === 'string' ? parseInt(offset) : offset;
  const hexStr = buffer.toString('hex', offset, offset + length);
  return Buffer.from(hexStr, 'hex');
}

export function getStrHex(
  libraryData: LibData,
  offset: LibOffset,
  signatureLength: SignatureLength,
) {
  offset = typeof offset === 'string' ? parseInt(offset) : offset;
  const hexString = libraryData.toString(
    'hex', // @ts-ignore
    offset,
    offset + signatureLength,
  );

  return hexString.replace(/.{2}/g, '$& ');
}
