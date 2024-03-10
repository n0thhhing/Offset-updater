const isRegExp = (obj: any): obj is RegExp => obj instanceof RegExp;
const processPattern = (pattern: Pattern): RegExp => {
  const newPattern: RegExp = new RegExp(
    pattern
      .replace(/\s+|\?/g, (char) => (char === '?' ? '.' : ''))
      .toLowerCase(),
    'g',
  );
  return newPattern;
};

function scan(pattern: RegExp | Pattern, hexString: Hex): Offset[] {
  const matchesIndexes: number[] = [];
  const regexPattern = isRegExp(pattern) ? pattern : processPattern(pattern);

  let match;
  while ((match = regexPattern.exec(hexString)) !== null) {
    matchesIndexes.push(match.index / 2);
  }

  return matchesIndexes;
}

export { isRegExp, processPattern, scan, strSearch };
