import fs from 'fs';
interface BytePattern {
  pattern: string;
}

interface ByteScanner {
  scan(buffer: Buffer, pattern: string): number[];
}

const ByteScanner: ByteScanner = {
  scan: (buffer: Buffer, pattern: string): number[] => {
    const patternBytes = parsePattern(pattern);
    const positions: number[] = [];
    for (let i = 0; i < buffer.length - patternBytes.length; i++) {
      let found = true;
      for (let j = 0; j < patternBytes.length; j++) {
        if (patternBytes[j] !== -1 && buffer[i + j] !== patternBytes[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        positions.push(i);
      }
    }
    return positions;
  },
};

function parsePattern(pattern: string): number[] {
  const bytes = pattern.split(' ');
  return bytes.map((byte) => {
    if (byte === '??') {
      return -1;
    } else {
      return parseInt(byte, 16);
    }
  });
}
const start = Bun.nanoseconds();
const buffer = fs.readFileSync('libs/new.so');
const pattern =
  'f5 53 be a9 f3 7b 01 a9 ?? ?? ?? ?? ?? ?? ?? 39 f3 03 01 2a f4 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52 ?? ?? ?? 39 e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 01 13 6b ?? ?? ?? ?? e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 e1 03 13 2a 02 01 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 91 e1 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 00 00 80 12 ?? ?? ?? ?? c0 03 5f d6 ?? ?? ?? ?? e9 23 bb 6d f9 63 01 a9 f7 5b 02 a9 f5 53 03 a9 f3 7b 04 a9 ?? ?? ?? ??';
const positions = ByteScanner.scan(buffer, pattern);
console.log(
  'Pattern found at positions:',
  positions, ///.map((offset) => `0x${offset.toString(16)}`),
  (Bun.nanoseconds() - start) / 1_000_000 + 'ms',
);