import { promises as fs } from 'fs';
import chalk from 'chalk';

const OFFSET_FILE = 'offsets.txt';
const OLD_LIBRARY_PATH = 'libs/old.so';
const NEW_LIBRARY_PATH = 'libs/new.so';
const OUTPUT_FILE = 'dist/output.txt';

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

async function findOffsetsInNewLibrary(oldOffsets, oldLibraryData, newLibraryData) {
  const newOffsets = [];

  oldOffsets.forEach(async (offset) => {
    try {
      const oldMemorySlice = oldLibraryData.slice(offset, offset + 100); // Adjust the size as needed
      const closestMatch = findClosestMatch(newLibraryData, oldMemorySlice);

      if (closestMatch) {
        const newOffset = newLibraryData.indexOf(closestMatch);
        newOffsets.push(newOffset);
        console.log(chalk.green(`Found offset: 0x${offset.toString(16)} in new library.`));
      } else {
        console.log(chalk.yellow(`Could not find a match for offset: 0x${offset.toString(16)}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error finding offset: 0x${offset.toString(16)} - ${error.message}`));
    }
  });

  return newOffsets;
}

async function writeOffsetsToFile(offsets) {
  try {
    const data = offsets.map(offset => `0x${offset.toString(16).toUpperCase()}`).join('\n');
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

    const newOffsets = await findOffsetsInNewLibrary(oldOffsets, oldLibraryData, newLibraryData);

    await writeOffsetsToFile(newOffsets);
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

main();
