import { promises as fs } from "fs";
import chalk from "chalk";

const config = {
  JUDSN: false, // if you dont know what this is set it to false
  COMPARISONS: true, // TODO
  OFFSET_FILE: "offsets.txt",
  OLD_LIBRARY_PATH: "libs/old.so",
  NEW_LIBRARY_PATH: "libs/new.so",
  OUTPUT_FILE: "dist/output.txt",
  OLD_MEMORY_SLICE_SIZE: 400,
  OFFSET_PADDING: 100,
  OLD_HEX_LENGTH: 64
};

async function readOffsetsFromFile() {
  try {
    const data = await fs.readFile(config.OFFSET_FILE, "utf-8");
    return data
      .trim()
      .split("\n")
      .map((line) => {
        const [offsetStr, name] = line.split("--").map((str) => str.trim());
        return { offset: parseInt(offsetStr.trim(), 16), name };
      });
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
    oldOffsets.map(async ({ offset, name }) => {
      try {
        const firstCharacter = oldLibraryData[offset]; // Assuming the offset is within bounds
        const oldMemorySlice = oldLibraryData.slice(offset, offset + config.OLD_MEMORY_SLICE_SIZE); // Adjust the size as needed
        const oldHex = oldLibraryData.slice(offset, offset + config.OLD_HEX_LENGTH);

        const startTime = process.hrtime();
        const { closestMatch, iterationCount } = findClosestMatch(
          newLibraryData,
          oldMemorySlice,
          firstCharacter,
        );
        const endTime = process.hrtime(startTime);

        if (closestMatch) {
          const newOffset = newLibraryData.indexOf(closestMatch);
          results.push({
            oldOffset: offset,
            closestMatch: closestMatch.toString("hex"),
            newOffset: newOffset,
            iterationCount: iterationCount,
            name,
            oldHex: oldHex.toString("hex")
          });

          const elapsedTime = endTime[0] * 1000 + endTime[1] / 1e6; // convert to milliseconds
          const elapsedTimeSeconds = elapsedTime / 1000;
          console.log(
            chalk.green(
              `Found offset: ${chalk.blue(
                `0x${offset.toString(16)}`,
              )} in the new library => ${chalk.blue(
                `0x${newOffset.toString(16).toUpperCase()}`
              )} (${name ? name + "" : ""})${chalk.grey(
                ` - ${elapsedTimeSeconds.toFixed(3)}s ${elapsedTime.toFixed(0)}ms`,
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

async function writeOffsetsToFile(results) {
  try {
    let data = "";
    let count = 1;

    results.forEach(({ oldOffset, closestMatch, newOffset, iterationCount, name, oldHex }) => {
      const offsetHeader = config.JUDSN
        ? `I[${count++}] = 0x${newOffset.toString(16).toUpperCase()}`
        : `Offset: 0x${oldOffset.toString(16).toUpperCase()}${" ".repeat(config.OFFSET_PADDING - oldOffset.toString(16).length)}`;

      const matchDetails = config.JUDSN
        ? (name ? ` -- ${name}` : "")
        : `\n Closest match:\n  * OldHex: ${oldHex}\n  * Hex: ${closestMatch}\n  * Offset: 0x${newOffset.toString(16).toUpperCase()}\n  * Iteration Count: ${iterationCount}\n${name ? `  * Name: ${name}\n` : ""}\n`;

      data += `${offsetHeader}${matchDetails}\n`;
    });

    await fs.writeFile(config.OUTPUT_FILE, config.JUDSN ? `I = {}\n${data}` : data);

    console.log(chalk.green(`Offsets written to ${chalk.blue(config.OUTPUT_FILE)}`));
  } catch (error) {
    throw new Error(`Error writing offsets to file: ${error.message}`);
  }
}

async function main() {
  try {
    const oldOffsets = await readOffsetsFromFile();
    const oldLibraryData = await readLibraryFile(config.OLD_LIBRARY_PATH);
    const newLibraryData = await readLibraryFile(config.NEW_LIBRARY_PATH);

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
