import { promises as fs } from 'fs';
import chalk from 'chalk';
import { Worker, isMainThread, workerData } from 'worker_threads';
import FastMemoize from 'fast-memoize';
import { TextEncoder } from 'util';
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OFFSET_FILE = 'offsets.txt';
const OLD_LIBRARY_PATH = 'libs/old.so';
const NEW_LIBRARY_PATH = 'libs/new.so';
const OUTPUT_FILE = 'dist/output.txt';
const CHUNK_SIZE = 1000;

// Wrap functions with memoization for better performance
const memoizedFindClosestMatch = FastMemoize(findClosestMatch);
const memoizedPatternDistance = FastMemoize(patternDistance);

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
    return await fs.readFile(filePath);
  } catch (error) {
    throw new Error(`Error reading library file: ${error.message}`);
  }
}

function findClosestMatch(segment, patternBytes) {
  let closestMatch = null;
  let minDistance = Infinity;

  const patternLength = patternBytes.length;

  for (let i = 0; i < segment.length - patternLength + 1; i++) {
    const slice = segment.slice(i, i + patternLength);
    const distance = memoizedPatternDistance(patternBytes, slice);

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

function findOffsetsInNewLibraryChunk(oldOffsets, oldLibraryData, newLibraryData, start, end) {
  const results = [];

  oldOffsets.forEach((offset) => {
    try {
      const oldMemorySlice = oldLibraryData.slice(offset, offset + CHUNK_SIZE);
      const closestMatch = findClosestMatch(newLibraryData.slice(start, end), oldMemorySlice);

      if (closestMatch) {
        const newOffset = start + newLibraryData.slice(start, end).indexOf(closestMatch);
        results.push({
          oldOffset: offset,
          closestMatch: closestMatch.toString('hex'),
          newOffset: newOffset,
        });
        console.log(chalk.green(`Found offset: 0x${offset.toString(16)} in the new library.`));
      } else {
        console.log(chalk.yellow(`Could not find a match for offset: 0x${offset.toString(16)}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error finding offset: 0x${offset.toString(16)} - ${error.message}`));
    }
  });

  return results;
}

async function findOffsetsInNewLibrary(oldOffsets, oldLibraryData, newLibraryData) {
  const results = [];

  const workers = [];

  const encoder = new TextEncoder();
  const oldLibraryDataBuffer = encoder.encode(oldLibraryData);
  const newLibraryDataBuffer = encoder.encode(newLibraryData);

  const chunkSize = Math.ceil(newLibraryDataBuffer.length / 4); // Split the search into 4 chunks

  for (let i = 0; i < 4; i++) {
    const start = i * chunkSize;
    const end = (i + 1) * chunkSize;

    workers.push(new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          oldOffsets,
          oldLibraryData: oldLibraryDataBuffer,
          newLibraryData: newLibraryDataBuffer,
          start,
          end,
        },
      });

      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    }));
  }

  const chunksResults = await Promise.all(workers);

  chunksResults.forEach(chunkResults => {
    results.push(...chunkResults);
  });

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

    const results = await findOffsetsInNewLibrary(oldOffsets, oldLibraryData, newLibraryData);

    await writeOffsetsToFile(results);
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

if (!isMainThread) {
  // Worker thread logic
  const { oldOffsets, oldLibraryData, newLibraryData, start, end } = workerData;
  const chunkResults = findOffsetsInNewLibraryChunk(oldOffsets, oldLibraryData, newLibraryData, start, end);
  parentPort.postMessage(chunkResults);
} else {
  // Main thread logic
  main();
}
