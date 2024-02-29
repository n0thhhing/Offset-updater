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
                (haystack[i + j] === patternBytes[j] ||
                    patternBytes[j] === 0x2e)
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
    'f5 53 be a9 f3 7b 01 a9 ?? ?? ?? ?? ?? ?? ?? 39 f3 03 01 2a f4 03 00 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? 28 00 80 52 ?? ?? ?? 39 e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? b9 1f 01 13 6b ?? ?? ?? ?? e0 03 14 aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? f9 e1 03 13 2a 02 01 40 f9 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 91 e1 03 1f aa ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 00 00 80 12 ?? ?? ?? ?? c0 03 5f d6 ?? ?? ?? ?? e9 23 bb 6d f9 63 01 a9 f7 5b 02 a9 f5 53 03 a9 f3 7b 04 a9 ?? ?? ?? ??';
const fileBuffer = fs.readFileSync('./libs/new.so');
const offsets = BytePatternScanner.scan(pattern, fileBuffer);
console.log(
    'Pattern found at positions:',
    offsets,
    ((Bun.nanoseconds() - start) / 1_000_000).toFixed(3) + 'ms',
);
