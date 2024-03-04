import chalk from 'chalk';
const simd = require('simd');
function bufferToHexNative(buffer: Buffer): string {
  return buffer.toString('hex');
}

const len = 0x100,
  byteToHex = new Array(len),
  char = String.fromCharCode;
let n = 0;
for (; n < 0x0a; ++n) byteToHex[n] = '0' + n;
for (; n < 0x10; ++n) byteToHex[n] = '0' + char(n + 87);
for (; n < len; ++n) byteToHex[n] = n.toString(16);
function byteArrayToHex(byteArray) {
  const l = byteArray.length;
  let hex = '';
  for (let i = 0; i < l; ++i) hex += byteToHex[byteArray[i] % len];
  return hex;
}
function bufferToHex(arrayBuffer) {
  return byteArrayToHex(new Uint8Array(arrayBuffer));
}
function bufferToHex(buffer) {
  const hexLookupTable = new Uint8Array([
    48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102,
  ]);

  const bufferLength = buffer.length;
  const hexBuffer = new Uint8Array(bufferLength * 2);

  for (let i = 0; i < bufferLength; i += 32) {
    const simdBuffer1 = SIMD.Uint8x16.load(buffer, i);
    const simdBuffer2 = SIMD.Uint8x16.load(buffer, i + 16);

    const highNibbles1 = SIMD.Uint8x16.shiftRightLogical(simdBuffer1, 4);
    const lowNibbles1 = SIMD.Uint8x16.and(
      simdBuffer1,
      SIMD.Uint8x16.splat(0x0f),
    );
    const highNibbles2 = SIMD.Uint8x16.shiftRightLogical(simdBuffer2, 4);
    const lowNibbles2 = SIMD.Uint8x16.and(
      simdBuffer2,
      SIMD.Uint8x16.splat(0x0f),
    );

    const highHexChars1 = SIMD.Uint8x16.shuffle(
      highNibbles1,
      hexLookupTable,
      highNibbles1,
    );
    const lowHexChars1 = SIMD.Uint8x16.shuffle(
      lowNibbles1,
      hexLookupTable,
      lowNibbles1,
    );
    const highHexChars2 = SIMD.Uint8x16.shuffle(
      highNibbles2,
      hexLookupTable,
      highNibbles2,
    );
    const lowHexChars2 = SIMD.Uint8x16.shuffle(
      lowNibbles2,
      hexLookupTable,
      lowNibbles2,
    );

    const interleavedHexChars1 = SIMD.Uint8x16.shuffle(
      highHexChars1,
      lowHexChars1,
      [0, 16, 1, 17, 2, 18, 3, 19, 4, 20, 5, 21, 6, 22, 7, 23],
    );
    const interleavedHexChars2 = SIMD.Uint8x16.shuffle(
      highHexChars2,
      lowHexChars2,
      [0, 16, 1, 17, 2, 18, 3, 19, 4, 20, 5, 21, 6, 22, 7, 23],
    );

    SIMD.Uint8x16.store(hexBuffer, i * 2, interleavedHexChars1);
    SIMD.Uint8x16.store(hexBuffer, (i + 16) * 2, interleavedHexChars2);
  }

  // Convert the hex buffer directly to string
  const hexString = String.fromCharCode.apply(null, Uint8Array.from(hexBuffer));

  return hexString;
}

function benchmarkBufferToHexOptimized(bufferSize: number): void {
  const buffer = Buffer.alloc(bufferSize, 'a');

  const startNative = Bun.nanoseconds();
  const nativeHex = bufferToHexNative(buffer);
  const endNative = Bun.nanoseconds();
  const startCustom = Bun.nanoseconds();
  const customHex = bufferToHex(buffer);
  const endCustom = Bun.nanoseconds();
  const timeNative = (endNative - startNative) / 1_000_000; // Convert nanoseconds to milliseconds
  const timeCustom = (endCustom - startCustom) / 1_000_000; // Convert nanoseconds to milliseconds
  const fasterMethod = timeCustom < timeNative ? 'Custom' : 'Native';
  const timeDifference = Math.abs(timeCustom - timeNative);
  const timesFaster = timeCustom / timeNative;

  console.log(`${nativeHex}\n\n${customHex}`);
  console.log(chalk.blue(`Buffer size: ${bufferSize}`));
  console.log(chalk.gray('----------------------------------------'));
  console.log(
    chalk.gray(`Time taken by Native method: ${timeNative.toFixed(2)} ms`),
  );
  console.log(
    chalk.gray(`Time taken by Custom method: ${timeCustom.toFixed(2)} ms`),
  );
  console.log(
    chalk.gray(
      `The ${fasterMethod} method is faster by ${timeDifference.toFixed(2)} ms`,
    ),
  );
  console.log(
    chalk.gray(
      `The ${fasterMethod} method is ${timesFaster.toFixed(2)} times faster`,
    ),
  );
  console.log(chalk.gray('----------------------------------------'));
}

// Run benchmarks for different buffer sizes
const bufferSizes = [10, 50, 100, 50, 1000, 5000, 10000]; // Add more sizes as needed
for (const size of bufferSizes) {
  benchmarkBufferToHexOptimized(size);
}
