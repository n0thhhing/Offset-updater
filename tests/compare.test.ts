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

function compareBytes(
  byteArrays: number[][],
  offsets: number[],
): ComparisonResult[] {
  const results: ComparisonResult[] = [];
  const byteSize = 4;
  const d = new Capstone(ARCH, MODE);
  const instructionsArrays = byteArrays.map((byteArray, i) =>
    d.disasm(byteArray, offsets[i]),
  );
  const maxLength = Math.max(...instructionsArrays.map((arr) => arr.length));

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

const byteArrays = [
  getHexFromOffset(await readLib('./libs/old.so'), 0x4a70be8, 100000),
  getHexFromOffset(await readLib('./libs/new.so'), 0x4a625a0, 100000),
  //   hexStringToByteArray("F5 53 BE A9 F3 7B 01 A9 D5 9E 01 D0 A8 06 40 39 F3 03 01 2A F4 03 00 AA 28 01 00 37 40 74 01 D0 00 48 40 F9 42 4C 30 97 40 74 01 F0 00 7C 44 F9 3F 4C 30 97 28 00 80 52 A8 06 00 39 E0 03 14 AA F6 FD FF 97 40 03 00 B4 08 38 40 F9 08 03 00 B4 08 19 40 B9 1F 01 13 6B 2D 02 00 54 E0 03 14 AA EE FD FF 97 40 02 00 B4 00 38 40 F9 00 02 00 B4 48 74 01 F0 08 7D 44 F9 E1 03 13 2A 02 01 40 F9 A2 19 72 97 40 01 00 B4 F3 7B 41 A9 00 60 00 91 E1 03 1F AA F5 53 C2 A8 10 92 E2 17 F3 7B 41 A9 00 00 80 12 F5 53 C2 A8 C0 03 5F D6 66 4C 30 97 E9 23 BB 6D F9 63 01 A9 F7 5B 02 A9 F5 53 03 A9 F3 7B 04 A9 D5 9E 01 D0 B3 73 01 F0 A8 0A 40 39 73 4A 43 F9 F4 03 00 AA 88 04 00 37 80 75 01 D0 00 4C 40 F9 12 4C 30 97 60 71 01 B0 00 8C 47 F9 0F 4C 30 97 80 75 01 B0 00 5C 45 F9 0C 4C 30 97 A0 70 01 90 00 04 44 F9 09 4C 30 97 A0 70 01 90 00 98 46 F9 06 4C 30 97 80 70 01 F0 00 A0 43 F9 03 4C 30 97 A0 73 01 F0 00 48 43 F9 00 4C 30 97 40 75 01 F0 00 D0 45 F9 FD 4B 30 97 C0 77 01 F0 00 48 43 F9 FA 4B 30 97 80 70 01 D0 00 C4 47 F9 F7 4B 30 97 A0 74 01 F0 00 E0 47 F9 F4 4B 30 97 28 00 80 52 A8 0A 00 39 60 02 40 F9 EE 63 4D 94 00 11 00 B4 E1 03 1F AA 47 A8 E8 97 60 01 00 B4 60 02 40 F9 E8 63 4D 94 40 10 00 B4 E1 03 1F AA 41 A8 E8 97 E0 0F 00 B4 E1 03 1F AA 85 86 8F 97 F3 03 00 2A 02 00 00 14 F3 03 1F 2A B5 70 01 90 96 70 01 F0 80 3A 40 F9 B5 06 44 F9 D6 A2 43 F9 00 04 00 B4 08 18 40 B9 1F 05 00 71 AB 03 00 54 B4 74 01 F0 94 E2 47 F9 A2 02 40 F9 98 70 01 D0 D9 77 01 F0 57 75 01 F0 18 C7 47 F9 39 4B 43 F9 F7 D2 45 F9"),
  //   hexStringToByteArray("F5 53 BE A9 F3 7B 01 A9 75 9E 01 90 A8 26 40 39 F3 03 01 2A F4 03 00 AA 28 01 00 37 E0 73 01 90 00 F4 42 F9 FC 71 30 97 E0 73 01 B0 00 B8 46 F9 F9 71 30 97 28 00 80 52 A8 26 00 39 E0 03 14 AA F6 FD FF 97 40 03 00 B4 08 38 40 F9 08 03 00 B4 08 19 40 B9 1F 01 13 6B 2D 02 00 54 E0 03 14 AA EE FD FF 97 40 02 00 B4 00 38 40 F9 00 02 00 B4 E8 73 01 B0 08 B9 46 F9 E1 03 13 2A 02 01 40 F9 5C 33 72 97 40 01 00 B4 F3 7B 41 A9 00 60 00 91 E1 03 1F AA F5 53 C2 A8 12 A1 E2 17 F3 7B 41 A9 00 00 80 12 F5 53 C2 A8 C0 03 5F D6 20 72 30 97 E9 23 BB 6D F9 63 01 A9 F7 5B 02 A9 F5 53 03 A9 F3 7B 04 A9 75 9E 01 90 53 73 01 B0 A8 2A 40 39 73 CA 46 F9 F4 03 00 AA 88 04 00 37 20 75 01 90 00 34 43 F9 CC 71 30 97 E0 70 01 F0 00 88 47 F9 C9 71 30 97 20 75 01 90 00 20 40 F9 C6 71 30 97 20 70 01 D0 00 A0 43 F9 C3 71 30 97 20 70 01 D0 00 F8 45 F9 C0 71 30 97 20 70 01 B0 00 58 43 F9 BD 71 30 97 40 73 01 B0 00 C8 46 F9 BA 71 30 97 A0 76 01 B0 00 A0 47 F9 B7 71 30 97 A0 6F 01 D0 00 60 43 F9 B4 71 30 97 20 70 01 90 00 9C 47 F9 B1 71 30 97 40 74 01 D0 00 CC 42 F9 AE 71 30 97 28 00 80 52 A8 2A 00 39 60 02 40 F9 21 2A 4D 94 00 11 00 B4 E1 03 1F AA 9F AF E8 97 60 01 00 B4 60 02 40 F9 1B 2A 4D 94 40 10 00 B4 E1 03 1F AA 99 AF E8 97 E0 0F 00 B4 E1 03 1F AA CD C1 8F 97 F3 03 00 2A 02 00 00 14 F3 03 1F 2A 35 70 01 D0 36 70 01 B0 80 3A 40 F9 B5 A2 43 F9 D6 5A 43 F9 00 04 00 B4 08 18 40 B9 1F 05 00 71 AB 03 00 54 54 74 01 D0 94 CE 42 F9 A2 02 40 F9 38 70 01 90 B9 6F 01 D0 B7 76 01 B0 18 9F 47 F9 39 63 43 F9 F7 A2 47 F9"),
];

const offsets = [0x4a70be8, 0x4a625a0];

const differences = compareBytes(byteArrays, offsets);
console.log(differences);
