import { ARCH, Capstone, MODE, getHexFromOffset, readLib } from '../utils';

interface ComparisonResult {
  Bytes: {
    byte: string[];
  };
  Instructions: string[][];
  Index: number;
}

function byteArrayToHexString(byteArray: number[]): string {
  return byteArray.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function compareBytes(byteArrays: any, offsets: number[]): ComparisonResult[] {
  const results: ComparisonResult[] = [];
  const byteSize = 4;
  const d = new Capstone(ARCH, MODE);
  const instructionsArrays = byteArrays.map((byteArray: any, i: number) =>
    d.disasm(byteArray, offsets[i]),
  );
  const maxLength = Math.max(
    ...instructionsArrays.map((arr: any) => arr.length),
  );

  for (let i = 0; i < maxLength; i += byteSize) {
    const byteInstructions: string[][] = [];
    const byteBytes: string[] = [];

    for (let j = 0; j < byteArrays.length; j++) {
      const instructions = instructionsArrays[j];
      const offset = offsets[j];

      if (i < instructions.length) {
        const instruction = instructions[i];
        byteInstructions.push([
          instruction.mnemonic + ' | ' + instruction.op_str,
        ]);
        byteBytes.push(byteArrayToHexString(instruction.bytes));
      } else {
        byteInstructions.push([]);
        byteBytes.push('');
      }
    }

    const byteSet = new Set(byteBytes);
    if (byteSet.size > 1) {
      results.push({
        Bytes: { byte: byteBytes },
        Instructions: byteInstructions,
        Index: i,
      });
    }
  }

  d.close();

  return results;
}

function hexStringToByteArray(hexString: string): number[] {
  const sanitizedString = hexString.replace(/\s/g, '');
  const pairs = sanitizedString.match(/.{1,2}/g);

  if (!pairs) {
    return [];
  }

  return pairs.map((pair) => parseInt(pair, 16));
}

const newBytes = await readLib('./libs/new.so');
const oldBytes = await readLib('./libs/old.so');

if (oldBytes && newBytes) {
  const byteArrays = [
    getHexFromOffset(oldBytes, 0x4a70be8, 100000),
    getHexFromOffset(newBytes, 0x4a625a0, 100000),
  ];

  const offsets = [0x4a70be8, 0x4a625a0];

  const differences = compareBytes(byteArrays, offsets);
  console.log(differences);
}
