import { readFileSync } from "fs";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { fileURLToPath } from "url";
import path from "path";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const CHUNK_SIZE = 1000;
const OFFSET_BATCH_SIZE = 50;

/**
 * Reads a chunk of a binary file.
 *
 * @param {string} filePath - Path to the file.
 * @param {number} start - Start offset.
 * @param {number} end - End offset.
 * @returns {Buffer} - Binary data chunk.
 */
function readBinaryFileChunk(filePath, start, end) {
  return readFileSync(filePath, { start, end });
}

/**
 * Finds closest matches for given offsets in binary data.
 *
 * @param {number[]} offsets - List of memory offsets.
 * @param {Buffer} binaryData - Binary data to search in.
 * @param {Buffer} patternBytes - Pattern to search for.
 * @returns {Promise<Array>} - Array of closest matches with offsets.
 */
async function findClosestMatchesByOffsets(offsets, binaryData, patternBytes) {
  const offsetBatches = splitIntoBatches(offsets, OFFSET_BATCH_SIZE);

  const results = await Promise.all(
    offsetBatches.map(async (offsetBatch) => {
      const closestMatches = await Promise.all(
        offsetBatch.map(async (offset) => {
          const memorySlice = binaryData.slice(offset, offset + CHUNK_SIZE);
          const closestMatch = findClosestMatch(memorySlice, patternBytes);
          return { offset, closestMatch };
        }),
      );
      return closestMatches;
    }),
  );

  return results.flat();
}

/**
 * Finds the closest match of a pattern in a binary segment.
 *
 * @param {Buffer} segment - Binary segment to search in.
 * @param {Buffer} patternBytes - Pattern to search for.
 * @returns {Buffer} - Closest match.
 */
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

/**
 * Computes the distance between two binary patterns.
 *
 * @param {Buffer} pattern - First binary pattern.
 * @param {Buffer} segment - Second binary pattern.
 * @returns {number} - Pattern distance.
 */
function patternDistance(pattern, segment) {
  let distance = 0;

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== segment[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Gets memory content in hexadecimal format.
 *
 * @param {number} offset - Memory offset.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<string>} - Hexadecimal representation of memory content.
 */
async function getMemoryHex(offset, filePath) {
  try {
    let hex = "";

    for (let start = offset; start < offset + CHUNK_SIZE; start += CHUNK_SIZE) {
      const fileBuffer = readBinaryFileChunk(
        filePath,
        start,
        start + CHUNK_SIZE,
      );
      hex += fileBuffer.toString("hex");
    }

    return hex;
  } catch (error) {
    throw new Error(chalk.red(`Error getting memory hex: ${error.message}`));
  }
}

/**
 * Gets memory offset in a colored format.
 *
 * @param {string} hex - Hexadecimal pattern to find.
 * @param {string} filePath - Path to the file.
 * @returns {string} - Colored memory offset.
 */
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

/**
 * Main function to execute the offset updating process.
 */
async function main() {
  try {
    const filePath = "./libs/new.so";
    const offsets = [
      0x491f3b4, 0x491fea0, 0x2560730, 0x41a2218, 0x41a2218, 0x32f5130,
      0x32f4ef8 /* ... add more offsets here ... */,
    ];

    const patternHex =
      "F553BEA9F37B01A995C201F0A8864A39F303012AF40300AA28010037009A01D000D843F9CE703697009A01F0008447F9CB70369728008052A8860A39E00314AAF6FDFF97400300B4083840F9080300B4";
    const patternBytes = Buffer.from(patternHex, "hex");

    const binaryData = readFileSync(filePath);
    const closestMatches = await findClosestMatchesByOffsets(
      offsets,
      binaryData,
      patternBytes,
    );

    closestMatches.forEach(async ({ offset, closestMatch }) => {
      console.log(
        chalk.green(`Offset: 0x${offset.toString(16).toUpperCase()}`) +
          "\nClosest match:\n" +
          `  ${chalk.yellow("* Hex:")} ${chalk.blue(
            closestMatch.toString("hex"),
          )}\n` +
          `  ${chalk.yellow("* Offset:")} ${chalk.cyan(
            await getMemoryOffset(closestMatch, filePath),
          )}\n`,
      );
    });
  } catch (error) {
    console.error(chalk.red("Error:"), chalk.redBright(error.message));
  }
}

// Entry point
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
