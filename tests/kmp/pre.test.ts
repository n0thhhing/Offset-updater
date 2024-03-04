interface Pattern {
  bytes: (number | null)[];
  mask: boolean[];
}

interface BytePatternScanner {
  scan(buffer: Buffer, pattern: Pattern): number[];
}

class KMPBytePatternScanner implements BytePatternScanner {
  private computeLPSArray(pattern: (number | null)[]): Int32Array {
    const lps = new Int32Array(pattern.length);
    lps[0] = 0;
    let len = 0;

    for (let i = 1; i < pattern.length; i++) {
      while (len > 0 && pattern[len] !== pattern[i] && pattern[len] !== null) {
        len = lps[len - 1];
      }
      if (pattern[i] === pattern[len] || pattern[i] === null) {
        len++;
      }
      lps[i] = len;
    }
    return lps;
  }

  private kmpSearch(
    buffer: Buffer,
    pattern: (number | null)[],
    lps: Int32Array,
  ): number[] {
    const positions: number[] = [];
    let i = 0; // index for buffer[]
    let j = 0; // index for pattern[]

    const patternLength = pattern.length;
    const bufferLength = buffer.length;

    while (i < bufferLength) {
      while (j > 0 && pattern[j] !== buffer[i] && pattern[j] !== null) {
        j = lps[j - 1];
      }
      if (pattern[j] === buffer[i] || pattern[j] === null) {
        j++;
      }
      if (j === patternLength) {
        positions.push(i - j + 1);
        j = lps[j - 1];
      }
      i++;
    }
    return positions;
  }

  private convertPatternStringToBytes(pattern: string): Pattern {
    const start = Bun.nanoseconds(); // Start timing
    const bytes: (number | null)[] = [];
    const mask: boolean[] = [];
    const hexBytes = pattern.split(' ');
    for (let byte of hexBytes) {
      if (byte === '??') {
        bytes.push(null);
        mask.push(false);
      } else {
        bytes.push(parseInt(byte, 16));
        mask.push(true);
      }
    }
    const end = Bun.nanoseconds();
    console.log('convertPatternStringToBytes()', (end - start) / 1_000_000); // Log execution time

    return { bytes, mask };
  }

  scan(buffer: Buffer, pattern: Pattern): number[] {
    const start = Bun.nanoseconds(); // Start timing
    const positions: number[] = [];
    const { bytes, mask } = pattern;
    const patternBytes = bytes.map((byte, index) =>
      mask[index] ? byte : null,
    );

    if (patternBytes.length === 0) {
      return positions;
    }

    const lps = this.computeLPSArray(patternBytes);
    const end = Bun.nanoseconds(); // End timing
    const occurrences = this.kmpSearch(buffer, patternBytes, lps);
    console.log('scan()', (end - start) / 1_000_000); // Log execution time
    return occurrences;
  }
}

// Example usage:
import fs from 'fs';
const start = Bun.nanoseconds(); // Start timing

const buffer = fs.readFileSync('libs/new.so');
console.log('readFile()', (Bun.nanoseconds() - start) / 1_000_000);
const patternString =
  'f5 53 be a9 f3 7b 01 a9 ?? ?? ?? ?? ?? ?? ?? 39 f3 03 01 2a f4 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52 ?? ?? ?? 39 e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 01 13 6b ?? ?? ?? ?? e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 e1 03 13 2a 02 01 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 91 e1 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 00 00 80 12 ?? ?? ?? ?? c0 03 5f d6 ?? ?? ?? ?? e9 23 bb 6d f9 63 01 a9 f7 5b 02 a9 f5 53 03 a9 f3 7b 04 a9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 39 ?? ?? ?? f9 f4 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52 ?? ?? ?? 39 60 02 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? e1 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? 60 02 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? e1 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? e1 03 1f aa ?? ?? ?? ?? f3 03 00 2a ?? ?? ?? ?? f3 03 1f 2a ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? f9 ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 05 00 71 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 a2 02 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? f9 ?? ?? ?? f9 e1 03 1f 2a ?? ?? ?? ?? 88 02 40 f9 02 03 40 f9 e1 03 00 aa e3 03 1f aa e0 03 08 aa ?? ?? ?? ?? 28 03 40 f9 f4 03 00 aa ?? ?? ?? b9 ?? ?? ?? ?? e0 03 08 aa ?? ?? ?? ?? e1 02 40 f9 e0 03 14 aa ?? ?? ?? ?? f4 03 00 aa ?? ?? ?? ?? f4 03 1f aa c0 02 40 f9 ?? ?? ?? b9 ?? ?? ?? ?? ?? ?? ?? ?? e0 03 14 aa e1 03 1f aa e2 03 1f aa ?? ?? ?? ?? 00 10 3e 1e ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 05 00 71 ?? ?? ?? ?? e0 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 08 10 2e 1e ?? ?? ?? ?? e0 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 05 00 71 ?? ?? ?? ?? e0 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 e0 03 1f aa 08 05 00 51 7f 02 08 6b ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 e1 03 13 2a 02 01 40 f9 ?? ?? ?? ?? 08 1c a0 4e e0 03 1f aa ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? a2 02 40 f9';
const pattern: Pattern =
  new KMPBytePatternScanner().convertPatternStringToBytes(patternString);
const scanner: BytePatternScanner = new KMPBytePatternScanner();
const positions = scanner.scan(buffer, pattern);
const end = Bun.nanoseconds(); // End timing
console.log('Positions:', positions, (end - start) / 1_000_000);
