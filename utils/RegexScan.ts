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
  if (!isRegExp(pattern)) pattern = processPattern(pattern);
  const matchesIndexes: number[] = [];
  let match;
  while ((match = pattern.exec(hexString)) !== null) {
    matchesIndexes.push(match.index / 2);
  }
  return matchesIndexes;
}
export { isRegExp, processPattern, scan };
