import { getHexFromOffset, instrIsWildCard } from '.';

async function getPattern(
  disassembler: Capstone,
  buffer: Buffer,
  offset: Offset,
  len: SignatureLength,
): Promise<string> {
  const hex: Buffer = getHexFromOffset(buffer, offset, len);
  const instructions: Instruction[] = disassembler.disasm(hex, offset);
  let pattern: string = '';

  for (const instr of instructions) {
    const {
      isWildCard,
      specialByte,
    }: { isWildCard: boolean; specialByte: boolean } = instrIsWildCard(instr);
    if (isWildCard) {
      pattern += specialByte
        ? '??????' + instr.bytes[3].toString(16).padStart(2, '0')
        : '????????';
    } else {
      pattern += Buffer.from(instr.bytes).toString('hex');
    }
  }

  pattern = pattern.match(/.{2}/g)?.join(' ') ?? '';
  return pattern;
}

export { getPattern };
