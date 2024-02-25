import chalk from 'chalk';
function colorizeDiff(oldPattern: Pattern, newPattern: Pattern): Pattern {
  const oldArr = oldPattern.replace(/\s+/g, '').match(/.{1,2}/g);
  const newArr = newPattern.replace(/\s+/g, '').match(/.{1,2}/g);
  const result = [];
  if (newArr && oldArr) {
    for (const [i, byte] of newArr.entries()) {
      if (byte != oldArr[i]) {
        result.push(chalk.yellow(byte));
      } else if (byte === '??') {
        result.push(chalk.red(byte));
      } else {
        result.push(byte);
      }
    }
    return result.join(' ');
  } else {
    return '';
  }
}

export { colorizeDiff };
