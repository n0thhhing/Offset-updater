import { readFileSync } from 'fs';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHUNK_SIZE = 1000
const OFFSET_BATCH_SIZE = 50;

function readBinaryFileChunk(filePath, start, end) {
  return readFileSync(filePath, { start, end });
}

async function findClosestMatchesByOffsets(offsets, binaryData, patternBytes) {
  const offsetBatches = splitIntoBatches(offsets, OFFSET_BATCH_SIZE);

  const results = await Promise.all(
    offsetBatches.map(async (offsetBatch) => {
      const closestMatches = await Promise.all(
        offsetBatch.map(async (offset) => {
          const memorySlice = binaryData.slice(offset, offset + CHUNK_SIZE);
          const closestMatch = findClosestMatch(memorySlice, patternBytes);
          return { offset, closestMatch };
        })
      );
      return closestMatches;
    })
  );

  return results.flat();
}

function findClosestMatch(segment, patternBytes) {
  let closestMatch = null;
  let minDistance = Infinity;

  const patternLength = patternBytes.length;

  for (let i = 0; i < segment.length - patternLength + 1; i++) {
    const slice = segment.slice(i, i + patternLength);
    const distance = patternDistance(patternBytes, slice);

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = slice;
    }
  }

  return closestMatch;
}

function patternDistance(pattern, segment) {
  let distance = 0;

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== segment[i]) {
      distance++;
    }
  }

  return distance;
}

async function getMemoryHex(offset, filePath) {
  try {
    let hex = '';

    for (let start = offset; start < offset + CHUNK_SIZE; start += CHUNK_SIZE) {
      const fileBuffer = readBinaryFileChunk(filePath, start, start + CHUNK_SIZE);
      hex += fileBuffer.toString('hex');
    }

    return hex;
  } catch (error) {
    throw new Error(chalk.red(`Error getting memory hex: ${error.message}`));
  }
}

async function getMemoryOffset(hex, filePath) {
  try {
    const fileBuffer = readFileSync(filePath);
    const hexPosition = fileBuffer.indexOf(hex);

    if (hexPosition !== -1) {
      return chalk.green(`0x${hexPosition.toString(16).toUpperCase()}`);
    } else {
      return chalk.yellow(`Hex ${hex} not found in the file.`);
    }
  } catch (error) {
    throw new Error(chalk.red(`Error getting memory offset: ${error.message}`));
  }
}

async function main() {
  try {
    const filePath = './libs/new.so';
    const offsets = [
      0x491F3B4, 0x491FEA0, 0x2560730, 0x41A2218, 0x41A2218, 0x32F5130, 0x32F4EF8/* ... add more offsets here ... */
    ];

    const patternHex = 'F553BEA9F37B01A995C201F0A8864A39F303012AF40300AA28010037009A01D000D843F9CE703697009A01F0008447F9CB70369728008052A8860A39E00314AAF6FDFF97400300B4083840F9080300B4';
    const patternBytes = Buffer.from(patternHex, 'hex');

    const binaryData = readFileSync(filePath);
    const closestMatches = await findClosestMatchesByOffsets(offsets, binaryData, patternBytes);

    closestMatches.forEach(async ({ offset, closestMatch }) => {
      console.log(
        chalk.green(`Offset: 0x${offset.toString(16).toUpperCase()}`) +
        '\nClosest match:\n' +
        `  ${chalk.yellow('* Hex:')} ${chalk.blue(closestMatch.toString('hex'))}\n` +
        `  ${chalk.yellow('* Offset:')} ${chalk.cyan(await getMemoryOffset(closestMatch, filePath))}\n`
      );
    });
  } catch (error) {
    console.error(chalk.red('Error:'), chalk.redBright(error.message));
  }
}

if (isMainThread) {
  main();
} else {
  const { scriptPath, functionName, args } = workerData;
  const result = eval(`${functionName}(${JSON.stringify(args)})`);
  parentPort.postMessage(result);
}

function splitIntoBatches(arr, batchSize) {
  const batches = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }
  return batches;
}
