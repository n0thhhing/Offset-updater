import { readFileSync } from 'fs';

interface BytePattern {
  pattern: string;
}

interface BufferData {
  buffer: Buffer;
}

type Byte = number;
type BytePatternMatch = Byte | undefined;

enum Wildcard {
  Any = 256,
}
namespace BytePatternScanner {
  export function patternToByteArray(pattern: string): Byte[] {
    return pattern.split(' ').map((byte) => {
      if (byte === '??') return Wildcard.Any;
      return parseInt(byte, 16);
    });
  }

  export function matchPattern(
    buffer: Buffer,
    pattern: Byte[],
  ): BytePatternMatch {
    for (let i = 0; i < buffer.length - pattern.length + 1; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (pattern[j] !== Wildcard.Any && pattern[j] !== buffer[i + j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }

  export function findPattern(
    data: BufferData,
    bytePattern: BytePattern,
  ): BytePatternMatch {
    const byteArrayPattern = patternToByteArray(bytePattern.pattern);
    return matchPattern(data.buffer, byteArrayPattern);
  }
}
const start = Bun.nanoseconds()
const bufferData: BufferData = { buffer: readFileSync('libs/new.so') };
const bytePattern: BytePattern = {
  pattern:
    'f5 53 be a9 f3 7b 01 a9 ?? ?? ?? ?? ?? ?? ?? 39 f3 03 01 2a f4 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52 ?? ?? ?? 39 e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 01 13 6b ?? ?? ?? ?? e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 e1 03 13 2a 02 01 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 91 e1 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 00 00 80 12 ?? ?? ?? ?? c0 03 5f d6 ?? ?? ?? ?? e9 23 bb 6d f9 63 01 a9 f7 5b 02 a9 f5 53 03 a9 f3 7b 04 a9 ?? ?? ?? ??',
};

const result = BytePatternScanner.findPattern(bufferData, bytePattern);
console.log(
  'Pattern found at position:',
  result,
  (Bun.nanoseconds() - start) / 1_000_000 + 'ms',
);