namespace BytePatternScanner {
  export function scan(pattern: string, buffer: Buffer | string): number[] {
    const patternBytes = parsePattern(pattern);
    const haystack =
      typeof buffer === 'string' ? Buffer.from(buffer, 'hex') : buffer;

    if (patternBytes.length > haystack.length) {
      throw new Error('Pattern length exceeds buffer length');
    }

    const offsets: number[] = [];
    const bmTable = createBoyerMooreTable(patternBytes);

    let i = 0;
    while (i <= haystack.length - patternBytes.length) {
      let j = patternBytes.length - 1;
      while (
        j >= 0 &&
        (haystack[i + j] === patternBytes[j] || patternBytes[j] === 0x2e)
      ) {
        j--;
      }
      if (j < 0) {
        offsets.push(i);
        i += patternBytes.length;
      } else {
        i += Math.max(1, j - bmTable[haystack[i + j]]);
      }
    }

    return offsets;
  }

  function parsePattern(pattern: string): number[] {
    const bytes = pattern.split(' ').map((byte) => {
      if (byte === '??') {
        return 0x2e; // Wildcard: matches any byte
      } else {
        return parseInt(byte, 16);
      }
    });
    return bytes;
  }

  function createBoyerMooreTable(pattern: number[]): number[] {
    const table: number[] = Array(256).fill(-1);
    for (let i = 0; i < pattern.length; i++) {
      table[pattern[i]] = i;
    }
    return table;
  }
}

export { BytePatternScanner };
import fs from 'fs';
const start = Bun.nanoseconds();
// Example usage:
const pattern =
  'f4 0f 1e f8 f3 7b 01 a9 f4 c7 02 b0 88 72 65 39 f3 03 00 aa c8 00 00 37 c0 9a 02 f0 00 34 47 f9 03 7a c5 97 28 00 80 52 88 72 25 39 68 0e 40 f9 a8 01 00 b4 c9 9a 02 f0 29 35 47 f9 13 15 40 f9 20 01 40 f9 09 e0 40 b9 49 00 00 35 35 7a c5 97 e0 03 13 aa f3 7b 41 a9 e1 03 1f aa f4 07 42 f8 5a bc c2 14 f3 7b 41 a9 e0 03 1f 2a f4 07 42 f8 c0 03 5f d6 08 0c 40 f9 88 00 00 b4 00 81 01 91 e1 03 1f aa 1d a9 77 14 e0 03 1f 2a c0 03 5f d6 e9 23 bc 6d f7 5b 01 a9 f5 53 02 a9 f3 7b 03 a9 f4 c7 02 b0 15 9b 02 90 88 82 65 39 b5 b6 40 f9 f3 03 00 aa c8 00 00 37 00 9b 02 90 00 b4 40 f9 db 79 c5 97 28 00 80 52';
const fileBuffer = fs.readFileSync('./libs/new.so');
const offsets = BytePatternScanner.scan(pattern, fileBuffer);
console.log(
  'Offsets:',
  offsets.map((offset) => `0x${offset.toString(16)}`),
  ((Bun.nanoseconds() - start) / 1_000_000).toFixed(3) + 'ms',
);
