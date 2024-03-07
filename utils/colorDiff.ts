import { color } from './';
function colorizeDiff(oldPattern: Pattern, newPattern: Pattern): Pattern {
  const oldArr = oldPattern.replace(/\s+/g, '').match(/.{1,2}/g);
  const newArr = newPattern.replace(/\s+/g, '').match(/.{1,2}/g);
  const result = [];
  if (newArr && oldArr) {
    for (const [i, byte] of newArr.entries()) {
      if (byte != oldArr[i]) {
        result.push(color.Yellow(byte));
      } else if (byte === '??') {
        result.push(color.Red(byte));
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
