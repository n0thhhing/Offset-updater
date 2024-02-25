namespace BytePatternScanner {
  export function scan(buffer: Buffer | string, pattern: Pattern): Offset[] {
    // Convert pattern to bytes array
    const patternBytes: number[] = parsePattern(pattern);

    // Convert buffer to bytes array if it's a string
    const bufferBytes: Buffer | number[] =
      typeof buffer === 'string' ? hexStringToBytes(buffer) : buffer;

    // Use KMP algorithm to find pattern
    const occurrences: number[] = kmpSearch(bufferBytes, patternBytes);

    return occurrences;
  }

  function parsePattern(pattern: string): number[] {
    const bytes: number[] = [];
    const hexDigits = pattern.split(' ');

    for (let i = 0; i < hexDigits.length; i++) {
      const hex = hexDigits[i];
      if (hex === '??') {
        bytes.push(-1); // Placeholder for wildcards
      } else {
        bytes.push(parseInt(hex, 16));
      }
    }

    return bytes;
  }

  function hexStringToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  function kmpSearch(text: Buffer | number[], pattern: number[]): number[] {
    const occurrences: number[] = [];
    const prefixTable = computePrefixTable(pattern);

    let j = 0;
    for (let i = 0; i < text.length; i++) {
      while (j > 0 && pattern[j] !== -1 && text[i] !== pattern[j]) {
        j = prefixTable[j - 1];
      }
      if (pattern[j] === -1 || text[i] === pattern[j]) {
        j++;
      }
      if (j === pattern.length) {
        occurrences.push(i - j + 1);
        j = prefixTable[j - 1];
      }
    }
    return occurrences;
  }

  function computePrefixTable(pattern: number[]): number[] {
    const prefixTable: number[] = new Array(pattern.length).fill(0);
    let j = 0;
    for (let i = 1; i < pattern.length; i++) {
      while (j > 0 && pattern[j] !== -1 && pattern[i] !== pattern[j]) {
        j = prefixTable[j - 1];
      }
      if (pattern[j] === -1 || pattern[i] === pattern[j]) {
        j++;
      }
      prefixTable[i] = j;
    }
    return prefixTable;
  }
}

export { BytePatternScanner };
const start = Bun.nanoseconds();


import fs from 'fs';
const buffer = fs.readFileSync('libs/new.so');
const pattern =
  'f5 53 be a9 f3 7b 01 a9 ?? ?? ?? ?? ?? ?? ?? 39 f3 03 01 2a f4 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52 ?? ?? ?? 39 e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 01 13 6b ?? ?? ?? ?? e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 e1 03 13 2a 02 01 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 91 e1 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 00 00 80 12 ?? ?? ?? ?? c0 03 5f d6 ?? ?? ?? ?? e9 23 bb 6d f9 63 01 a9 f7 5b 02 a9 f5 53 03 a9 f3 7b 04 a9 ?? ?? ?? ??';
const occurrences = BytePatternScanner.scan(buffer, pattern);
console.log(
  'Pattern found at positions:',
  occurrences,//.map((offset) => `0x${offset.toString(16)}`),
  (Bun.nanoseconds() - start) / 1_000_000 + 'ms',
);
