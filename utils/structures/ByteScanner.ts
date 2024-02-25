import * as fs from 'fs';

class ByteScanner {
  private pattern: number[];
  private filePath: string;
  private fileBuffer: Buffer;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.fileBuffer = fs.readFileSync(filePath);
    this.pattern = [];
  }

  private parsePattern(pattern: string): number[] {
    return pattern.split(' ').map((byte) => {
      if (byte === '??') {
        return -1;
      } else {
        return parseInt(byte, 16);
      }
    });
  }

  private boyerMooreSearch(buffer: Buffer): number[] {
    const pattern: number[] = this.pattern;
    const patternLength: SignatureLength = pattern.length;
    const bufferLength: SignatureLength = buffer.length;
    const lastOccurrence: any[] = new Array(256).fill(-1);

    for (let i = 0; i < patternLength; i++) {
      lastOccurrence[pattern[i]] = i;
    }

    const indexes: number[] = [];
    let i = 0;

    while (i <= bufferLength - patternLength) {
      let j = patternLength - 1;
      while (j >= 0 && (pattern[j] === buffer[i + j] || pattern[j] === -1)) {
        j--;
      }
      if (j < 0) {
        indexes.push(i);
        i += patternLength;
      } else {
        i += Math.max(1, j - lastOccurrence[buffer[i + j]]);
      }
    }

    return indexes;
  }

  public setPattern(pattern: string): void {
    this.pattern = this.parsePattern(pattern);
  }

  public scan(): number[] {
    return this.boyerMooreSearch(this.fileBuffer);
  }
}

export { ByteScanner };
