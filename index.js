import { promises as fs } from "fs";
import chalk from "chalk";

const OFFSET_FILE = "offsets.txt";
const OLD_LIBRARY_PATH = "libs/old.so";
const NEW_LIBRARY_PATH = "libs/new.so";
const OUTPUT_FILE = "dist/output.txt";

async function readOffsetsFromFile() {
  try {
    const data = await fs.readFile(OFFSET_FILE, "utf-8");
    return data
      .trim()
      .split("\n")
      .map((line) => parseInt(line.trim(), 16));
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

function findClosestMatch(segment, patternBytes, firstCharacter) {
  let closestMatch = null;
  let minDistance = Infinity;
  let iterationCount = 0;

  const patternLength = patternBytes.length;

  for (let i = 0; i < segment.length - patternLength + 1; i++) {
    // Skip iterations if the first character doesn't match
    if (firstCharacter !== segment[i]) {
      continue;
    }

    const slice = segment.slice(i, i + patternLength);
    const distance = patternDistance(patternBytes, slice);

    iterationCount++;

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = slice;
    }
  }

  return { closestMatch, iterationCount };
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

async function findOffsetsInNewLibrary(
  oldOffsets,
  oldLibraryData,
  newLibraryData,
) {
  const results = [];
  const cpuStart = process.cpuUsage();

  await Promise.all(
    oldOffsets.map(async (offset) => {
      try {
        const firstCharacter = oldLibraryData[offset]; // Assuming the offset is within bounds
        const oldMemorySlice = oldLibraryData.slice(offset, offset + 100); // Adjust the size as needed

        const { closestMatch, iterationCount } = findClosestMatch(
          newLibraryData,
          oldMemorySlice,
          firstCharacter,
        );

        if (closestMatch) {
          const newOffset = newLibraryData.indexOf(closestMatch);
          results.push({
            oldOffset: offset,
            closestMatch: closestMatch.toString("hex"),
            newOffset: newOffset,
            iterationCount: iterationCount,
          });
          console.log(
            chalk.green(
              `Found offset: ${chalk.blue(
                `0x${offset.toString(16)}`,
              )} in the new library => ${chalk.blue(
                `x${newOffset.toString(16).toUpperCase()}`,
              )}`,
            ),
          );
        } else {
          console.log(
            chalk.yellow(
              `Could not find a match for offset: 0x${offset.toString(16)}`,
            ),
          );
        }
      } catch (error) {
        console.error(
          chalk.red(
            `Error finding offset: 0x${offset.toString(16)} - ${error.message}`,
          ),
        );
      }
    }),
  );

  const cpuEnd = process.cpuUsage(cpuStart);
  const elapsedTime = cpuEnd.user / 1000; // convert to milliseconds
  console.log(
    chalk.gray(
      `CPU Usage: ${chalk.blue(cpuEnd.user)}us User, ${chalk.blue(
        cpuEnd.system,
      )}us System`,
    ),
  );
  console.log(
    chalk.gray(`Total elapsed time: ${chalk.blue(elapsedTime.toFixed(2))}ms`),
  );

  return results;
}

// The rest of your code remains unchanged

async function writeOffsetsToFile(results) {
  try {
    let data = "";
    results.forEach(
      ({ oldOffset, closestMatch, newOffset, iterationCount }) => {
        data +=
          `Offset: 0x${oldOffset.toString(16).toUpperCase()}${" ".repeat(
            60 - oldOffset.toString(16).length,
          )}` +
          `Closest match:\n* Hex: ${closestMatch}\n* Offset: 0x${newOffset
            .toString(16)
            .toUpperCase()}\n` +
          `* Iteration Count: ${iterationCount}\n\n`;
      },
    );
    await fs.writeFile(OUTPUT_FILE, data);
    console.log(chalk.green(`Offsets written to ${chalk.blue(OUTPUT_FILE)}`));
  } catch (error) {
    throw new Error(`Error writing offsets to file: ${error.message}`);
  }
}

async function main() {
  try {
    const oldOffsets = await readOffsetsFromFile();
    const oldLibraryData = await readLibraryFile(OLD_LIBRARY_PATH);
    const newLibraryData = await readLibraryFile(NEW_LIBRARY_PATH);

    const results = await findOffsetsInNewLibrary(
      oldOffsets,
      oldLibraryData,
      newLibraryData,
    );

    await writeOffsetsToFile(results);
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

main();
