import chalk from 'chalk';

const ITERATIONS = 1000;
const bufferLengths = [100, 1000, 10000];
const results = {};

const LUT_HEX_4b = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
];
function bufferToHex(buffer) {
  let out = '';
  for (let idx = 0; idx < buffer.length; idx++) {
    let n = buffer[idx];
    out += LUT_HEX_4b[(n >>> 4) & 0xf];
    out += LUT_HEX_4b[n & 0xf];
  }
  return out;
}

const LUT_HEX_8b = new Array(256);
const hexDigits = '0123456789abcdef';

for (let i = 0; i < 16; i++) {
  const hi = hexDigits[i];
  for (let j = 0; j < 16; j++) {
    LUT_HEX_8b[i * 16 + j] = hi + hexDigits[j];
  }
}

console.log(LUT_HEX_8b);

function toHex(buffer) {
  let out = '';
  for (let idx = 0, edx = buffer.length; idx < edx; idx++) {
    out += LUT_HEX_8b[buffer[idx]];
  }
  return out;
}

function populateBuffer(length) {
  const buffer = [];
  for (let i = 0; i < length; i++) {
    buffer.push(Math.floor(Math.random() * 256));
  }
  return buffer;
}

function benchmark(func, buffer) {
  const start = Bun.nanoseconds();
  for (let i = 0; i < ITERATIONS; i++) {
    func(buffer);
  }
  const end = Bun.nanoseconds();
  return (end - start) / 1000000;
}

for (let length of bufferLengths) {
  const buffer = populateBuffer(length);
  const stackOverflowTime = benchmark(bufferToHex, buffer);
  const eightBitTime = benchmark(toHex, buffer);
  const toStringTime = benchmark((buffer) => buffer.toString(16), buffer);
  results[length] = {
    fourBitLut: stackOverflowTime,
    eightBitLut: eightBitTime,
    toString: toStringTime,
  };
}

console.log(chalk.bold(chalk.green('Benchmark Results:')));
console.log(chalk.bold(chalk.yellow('Length\t\t4-bit\t\t\t8-bit\t\t\tNative')));
for (let length of bufferLengths) {
  const stackOverflowTime = results[length].fourBitLut;
  const eightBitTime = results[length].eightBitLut;
  const toStringTime = results[length].toString;
  console.log(
    chalk.grey(
      `${chalk.blue(length)}\t\t${chalk.blue(stackOverflowTime.toFixed(4))}ms\t\t${chalk.blue(eightBitTime.toFixed(4))}ms\t\t${chalk.blue(toStringTime.toFixed(4))}ms`,
    ),
  );
}

// Compare performance
const stackOverflowAvg = results[100].fourBitLut / ITERATIONS;
const eightBitAvg = results[100].eightBitLut / ITERATIONS;
const toStringAvg = results[100].toString / ITERATIONS;

let faster = '';
if (stackOverflowAvg < eightBitAvg && stackOverflowAvg < toStringAvg) {
  faster = 'stackOverflow';
} else if (eightBitAvg < stackOverflowAvg && eightBitAvg < toStringAvg) {
  faster = 'eightBit';
} else {
  faster = 'toString';
}

let difference = 0;
if (faster === 'stackOverflow') {
  difference = ((eightBitAvg - stackOverflowAvg) / eightBitAvg) * 100;
} else if (faster === 'eightBit') {
  difference = ((toStringAvg - eightBitAvg) / toStringAvg) * 100;
} else {
  difference = ((eightBitAvg - toStringAvg) / eightBitAvg) * 100;
}

console.log(
  chalk.bold(
    chalk.green(
      `\n${chalk.yellow(faster)} is faster by ${chalk.blue(difference.toFixed(2))}%`,
    ),
  ),
);
