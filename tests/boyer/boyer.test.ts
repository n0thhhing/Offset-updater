import * as fs from 'fs';

class BytePatternScanner {
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
        const pattern = this.pattern;
        const patternLength = pattern.length;
        const bufferLength = buffer.length;
        const lastOccurrence = new Array(256).fill(-1);

        for (let i = 0; i < patternLength; i++) {
            lastOccurrence[pattern[i]] = i;
        }

        const indexes: number[] = [];
        let i = 0;

        while (i <= bufferLength - patternLength) {
            let j = patternLength - 1;
            while (
                j >= 0 &&
                (pattern[j] === buffer[i + j] || pattern[j] === -1)
            ) {
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

// Usage
const start = Bun.nanoseconds();
const filePath = './libs/new.so';
const scanner = new BytePatternScanner(filePath);

// Set pattern
scanner.setPattern(
    'f4 0f 1e f8 f3 7b 01 a9 ?? ?? ?? ?? ?? ?? ?? 39 f3 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52 ?? ?? ?? 39 ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? f9 20 01 40 f9 ?? ?? ?? b9 ?? ?? ?? ?? ?? ?? ?? ?? e0 03 13 aa ?? ?? ?? ?? e1 03 1f aa ?? ?? ?? f8 ?? ?? ?? ?? ?? ?? ?? ?? e0 03 1f 2a ?? ?? ?? f8 c0 03 5f d6 ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? 91 e1 03 1f aa ?? ?? ?? ?? e0 03 1f 2a c0 03 5f d6 e9 23 bc 6d f7 5b 01 a9 f5 53 02 a9 f3 7b 03 a9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 39 ?? ?? ?? f9 f3 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52',
);
const occurrences = scanner.scan();
console.log(
    'Occurrences found at indexes:',
    occurrences.map((offset) => `0x${offset.toString(16)}`),
    ((Bun.nanoseconds() - start) / 1_000_000).toFixed(3) + 'ms',
);
