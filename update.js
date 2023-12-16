import { promises as fs } from 'fs';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import chalk from 'chalk';
import pkg from 'text-encoding';
const { TextDecoder } = pkg;
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OFFSET_FILE = 'offsets.txt';
const OLD_LIBRARY_PATH = 'libs/old.so';
const NEW_LIBRARY_PATH = 'libs/new.so';
const OUTPUT_FILE = 'dist/output.txt';

const CHUNK_SIZE = 1000;
const OFFSET_BATCH_SIZE = 50; // Added OFFSET_BATCH_SIZE

async function readOffsetsFromFile() {
  try {
    const data = await fs.readFile(OFFSET_FILE, 'utf-8');
    return data.trim().split('\n').map(line => parseInt(line.trim(), 16));
  } catch (error) {
    throw new Error(`Error reading offsets file: ${error.message}`);
  }
}

async function readLibraryFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    return new Uint8Array(buffer);
  } catch (error) {
    throw new Error(`Error reading library file: ${error.message}`);
  }
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

function findClosestMatch(segment, patternBytes) {
  let closestMatch = null;
  let minDistance = Infinity;

  const patternLength = patternBytes.length;

  for (let i = 0; i < segment.length - patternLength + 1; i++) {
    const slice = segment.subarray(i, i + patternLength);
    const distance = patternDistance(patternBytes, slice);

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = slice;
    }
  }

  return closestMatch;
}

async function findOffsetsInNewLibrary(oldOffsets, oldLibraryData, newLibraryData) {
  const offsetBatches = splitIntoBatches(oldOffsets, OFFSET_BATCH_SIZE);
  const results = [];

  for (const offsetBatch of offsetBatches) {
    const closestMatches = await Promise.all(
      offsetBatch.map(async (offset) => {
        try {
          const oldMemorySlice = oldLibraryData.slice(offset, offset + CHUNK_SIZE);
          const closestMatch = findClosestMatch(newLibraryData, oldMemorySlice);

          if (closestMatch) {
            const newOffset = newLibraryData.indexOf(closestMatch);
            results.push({
              oldOffset: offset,
              closestMatch: Buffer.from(closestMatch).toString('hex'),
              newOffset: newOffset,
            });
            console.log(chalk.green(`Found offset: 0x${offset.toString(16)} in the new library.`));
          } else {
            console.log(chalk.yellow(`Could not find a match for offset: 0x${offset.toString(16)}`));
          }
        } catch (error) {
          console.error(chalk.red(`Error finding offset: 0x${offset.toString(16)} - ${error.message}`));
        }
      })
    );
  }

  return results;
}

async function writeOffsetsToFile(results) {
  try {
    let data = '';
    results.forEach(({ oldOffset, closestMatch, newOffset }) => {
      data += `Offset: 0x${oldOffset.toString(16).toUpperCase()}${' '.repeat(60 - oldOffset.toString(16).length)}` +
        `Closest match:\n* Hex: ${closestMatch}\n* Offset: 0x${newOffset.toString(16).toUpperCase()}\n\n`;
    });
    await fs.writeFile(OUTPUT_FILE, data);
    console.log(chalk.green(`Offsets written to ${OUTPUT_FILE}`));
  } catch (error) {
    throw new Error(`Error writing offsets to file: ${error.message}`);
  }
}

async function main() {
  try {
    const oldOffsets = await readOffsetsFromFile();
    const oldLibraryData = await readLibraryFile(OLD_LIBRARY_PATH);
    const newLibraryData = await readLibraryFile(NEW_LIBRARY_PATH);

    const results = await findOffsetsInNewLibrary({ oldOffsets, oldLibraryData, newLibraryData });

    await writeOffsetsToFile(results);
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

if (isMainThread) {
  main();
} else {
  const { scriptPath, functionName, args } = workerData;
  const result = eval(`${functionName}(${JSON.stringify(args)})`);
  parentPort.postMessage(result);
}

/**
 * Splits an array into batches.
 *
 * @param {Array} arr - Array to split.
 * @param {number} batchSize - Size of each batch.
 * @returns {Array} - Array of batches.
 */
function splitIntoBatches(arr, batchSize) {
  const batches = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }
  return batches;
}
