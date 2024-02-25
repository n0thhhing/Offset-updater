import fs from 'fs';

interface BytePattern {
  pattern: string;
}

interface ByteScanner {
  scan(buffer: Buffer, pattern: BytePattern): number[];
}

class BytePatternScanner implements ByteScanner {
  scan(buffer: Buffer, pattern: BytePattern): number[] {
    const positions: number[] = [];
    const patternBytes = this.parsePattern(pattern.pattern);

    for (let i = 0; i < buffer.length; i++) {
      let match = true;
      for (let j = 0; j < patternBytes.length; j++) {
        if (patternBytes[j] !== null && patternBytes[j] !== buffer[i + j]) {
          match = false;
          break;
        }
      }
      if (match) {
        positions.push(i);
      }
    }

    return positions;
  }

  private parsePattern(pattern: string): (number | null)[] {
    const bytes = pattern.split(' ').map((byte) => {
      if (byte === '??') {
        return null;
      } else {
        return parseInt(byte, 16);
      }
    });
    return bytes;
  }
}

const start = Bun.nanoseconds();
const scanner = new BytePatternScanner();

const pattern: BytePattern = {
  pattern:
    'f5 53 be a9 f3 7b 01 a9 ?? ?? ?? ?? ?? ?? ?? 39 f3 03 01 2a f4 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52 ?? ?? ?? 39 e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 01 13 6b ?? ?? ?? ?? e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 e1 03 13 2a 02 01 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 91 e1 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 00 00 80 12 ?? ?? ?? ?? c0 03 5f d6 ?? ?? ?? ?? e9 23 bb 6d f9 63 01 a9 f7 5b 02 a9 f5 53 03 a9 f3 7b 04 a9 ?? ?? ?? ??',
};

const buffer: Buffer = fs.readFileSync('libs/new.so');

const positions = scanner.scan(buffer, pattern);
console.log(
  'Pattern found at positions:',
  positions,
  (Bun.nanoseconds() - start) / 1_000_000 + 'ms',
);
