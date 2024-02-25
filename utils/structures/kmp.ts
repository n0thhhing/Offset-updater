namespace KmpPatternScanner {
  export function scan(buffer: Buffer | string, pattern: string): number[] {
    const patternBytes: number[] = parsePattern(pattern);
    const bufferBytes: Buffer | number[] =
      typeof buffer === 'string' ? hexStringToBytes(buffer) : buffer;
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
    const prefixTable: number[] = computePrefixTable(pattern);

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

export { KmpPatternScanner };
