import fs, { promises as file } from "fs";
import chalk from "chalk";
import { findMethodType } from "./Functions/method-types.js";

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const {
  JUDSN,
  LOGGING,
  CHECK_TYPE,
  OLD_DUMP_PATH,
  NEW_DUMP_PATH,
  OFFSET_FILE,
  OLD_LIBRARY_PATH,
  NEW_LIBRARY_PATH,
  OUTPUT_FILE,
  OLD_MEMORY_SLICE_SIZE,
  OFFSET_PADDING,
  OLD_HEX_LENGTH,
  MAX_ITERATIONS,
  FIRST_CHAR_SAME,
} = config;

/**
 * Check if a file contains any offsets.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<boolean>} - Promise resolving to true if offsets are found, false otherwise.
 */
async function containsOffsets(fileData) {
  try {
    // Regular expression to match hexadecimal numbers
    const hexPattern = /\b0x[0-9a-fA-F]+\b/g;
    return hexPattern.test(fileData);
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    return false;
  }
}

/**
 * Reads offsets from a file and parses them into an array of objects.
 * @returns {Promise<Array<{ offset: number, name?: string }>>} Array of offset objects.
 * @throws {Error} If there is an error reading the offsets file.
 */
async function readOffsetsFromFile() {
  try {
    const data = await file.readFile(OFFSET_FILE, "utf-8");
    if (data === "" || !containsOffsets(data)) {
      console.error(chalk.red("You must actually have offsets in offsets.txt"));
      process.exit();
    }
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

/**
 * Reads the content of a library file and logs the execution time if logging is enabled.
 * @param {string} filePath - Path to the library file.
 * @returns {Promise<Buffer>} The content of the library file as a Buffer.
 * @throws {Error} If there is an error reading the library file.
 */
async function readLibraryFile(filePath) {
  try {
    const startTime = process.hrtime();
    const data = await file.readFile(filePath);
    const endTime = process.hrtime(startTime);

    if (LOGGING) {
      const elapsedTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(3);
      console.log(chalk.gray(`readLibraryFile: ${elapsedTime}ms`));
    }

    return data;
  } catch (error) {
    throw new Error(`Error reading library file: ${error.message}`);
    process.abort();
  }
}

/**
 * Finds the closest match in a segment based on pattern bytes and the first character.
 * @param {Buffer} segment - The segment to search within.
 * @param {Buffer} patternBytes - The pattern to match.
 * @param {number} firstCharacter - The first character of the pattern.
 * @returns {Object} Object containing the closest match and iteration count.
 */
function findClosestMatch(segment, patternBytes, firstCharacter) {
  let closestMatch = null;
  let minDistance = Infinity;
  let iterationCount = 0;

  const patternLength = patternBytes.length;

  for (let i = 0; i < segment.length - patternLength + 1; i++) {
    // Skip iterations if the first character doesn't match
    if (FIRST_CHAR_SAME && firstCharacter !== segment[i]) {
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

/**
 * Calculates the pattern distance between two buffers.
 * @param {Buffer} pattern - The pattern to compare.
 * @param {Buffer} segment - The segment to compare against.
 * @returns {number} The pattern distance.
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
 * Finds offsets in the new library based on old offsets, old library data, and new library data.
 * @param {Array<{ offset: number, name?: string }>} oldOffsets - Array of old offsets.
 * @param {Buffer} oldLibraryData - Content of the old library.
 * @param {Buffer} newLibraryData - Content of the new library.
 * @returns {Promise<Array<Object>>} Array of results with offset details.
 */
async function findOffsetsInNewLibrary(
  oldOffsets,
  oldLibraryData,
  newLibraryData,
) {
  const results = [];
  const cpuStart = process.cpuUsage();

  for (const { offset, name } of oldOffsets) {
    try {
      let currentOffset = offset;
      let iterationCount = 0;

      while (iterationCount < MAX_ITERATIONS) {
        const firstCharacter = oldLibraryData[currentOffset];
        const oldMemorySlice = oldLibraryData.slice(
          currentOffset,
          currentOffset + OLD_MEMORY_SLICE_SIZE,
        );
        const oldHex = oldLibraryData.slice(
          currentOffset,
          currentOffset + OLD_HEX_LENGTH,
        );

        const startTime = process.hrtime();
        const {
          closestMatch,
          iterationCount: innerIterationCount,
          status,
        } = findClosestMatch(newLibraryData, oldMemorySlice, firstCharacter);

        iterationCount += innerIterationCount;

        const endTime = process.hrtime(startTime);

        if (closestMatch) {
          const newOffset = newLibraryData.indexOf(closestMatch);

          // Check if type matching is enabled
          if (CHECK_TYPE) {
            const oldTypePromise = findMethodType(OLD_DUMP_PATH, currentOffset);
            const newTypePromise = findMethodType(NEW_DUMP_PATH, newOffset);

            const [oldType, newType] = await Promise.all([
              oldTypePromise,
              newTypePromise,
            ]);

            if (oldType && newType) {
              if (
                oldType.returnType !== newType.returnType ||
                oldType.methodType !== newType.methodType
              ) {
                currentOffset = newOffset + 1; // Skip the first 8 bytes
                console.log(
                  chalk.red("[TYPE_STATUS] - Failed") +
                    chalk.blue(" re trying..."),
                );
                continue; // Retry with the next match
              } else {
                console.log(chalk.green("[TYPE_STATUS] - Passed"));
              }
            } else {
              console.error(chalk.red("[TYPE_STATUS] - Error fetching types"));
              break; // Exit the loop in case of an error
            }
          }

          results.push({
            oldOffset: currentOffset,
            closestMatch: closestMatch.toString("hex"),
            newOffset: newOffset,
            iterationCount: iterationCount,
            name,
            oldHex: oldHex.toString("hex"),
          });

          if (LOGGING) {
            const elapsedTime = (
              endTime[0] * 1000 + endTime[1] / 1e6
            ).toFixed(3);
            console.log(
              chalk.green(
                `Found offset: ${chalk.blue(
                  `0x${currentOffset.toString(16)}`,
                )} in the new library => ${chalk.blue(
                  `0x${newOffset.toString(16).toUpperCase()}`,
                )} (${name ? name + "" : ""})${chalk.grey(
                  ` - ${elapsedTime}ms`,
                )}`,
              ),
            );
          }
          break; // Exit the loop once a match is found
        } else {
          if (LOGGING) {
            console.log(
              chalk.yellow(
                `Could not find a match for offset: 0x${currentOffset.toString(
                  16,
                )}`,
              ),
            );
          }
          break; // Exit the loop if no match is found
        }
      }
    } catch (error) {
      console.error(
        chalk.red(
          `Error finding offset: 0x${offset.toString(16)} - ${error.message}`,
        ),
      );
      process.abort();
    }
  }

  const cpuEnd = process.cpuUsage(cpuStart);
  const elapsedTime = cpuEnd.user / 1000; // convert to milliseconds

  if (LOGGING) {
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

  }

  return results;
}

/**
 * Writes offset details to a file.
 * @param {Array<Object>} results - Array of offset details.
 * @returns {Promise<void>} Promise indicating the completion of writing to the file.
 * @throws {Error} If there is an error writing to the file.
 */
async function writeOffsetsToFile(results) {
  try {
    let data = "";
    let count = 1;

    results.forEach(
      ({
        oldOffset,
        closestMatch,
        newOffset,
        iterationCount,
        name,
        oldHex,
      }) => {
        const offsetHeader = JUDSN
          ? `I[${count++}] = 0x${newOffset.toString(16).toUpperCase()}`
          : `Offset: 0x${oldOffset.toString(16).toUpperCase()}${" ".repeat(
              OFFSET_PADDING - oldOffset.toString(16).length,
            )}`;

        const matchDetails = JUDSN
          ? name
            ? ` -- ${name}`
            : ""
          : `\n Closest match:\n  * OldHex: ${oldHex}\n  * Hex: ${closestMatch}\n  * Offset: 0x${newOffset
              .toString(16)
              .toUpperCase()}\n  * Iteration Count: ${iterationCount}\n${
              name ? `  * Name: ${name}\n` : ""
            }\n`;

        data += `${offsetHeader}${matchDetails}\n`;
      },
    );

    await file.writeFile(OUTPUT_FILE, JUDSN ? `I = {}\n${data}` : data);

    console.log(chalk.green(`Offsets written to ${chalk.blue(OUTPUT_FILE)}`));
  } catch (error) {
    throw new Error(`Error writing offsets to file: ${error.message}`);
  }
}

/**
 * Main function orchestrating the entire process.
 * @returns {Promise<void>} Promise indicating the completion of the main process.
 */
async function main() {
  try {
    const startTime = process.hrtime();
    const oldOffsets = await readOffsetsFromFile();
    const oldLibraryData = await readLibraryFile(OLD_LIBRARY_PATH);
    const newLibraryData = await readLibraryFile(NEW_LIBRARY_PATH);

    const results = await findOffsetsInNewLibrary(
      oldOffsets,
      oldLibraryData,
      newLibraryData,
    );

    await writeOffsetsToFile(results);

    if (LOGGING) {
      const endTime = process.hrtime(startTime);
      const elapsedTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);
      console.log(
        chalk.gray(`Total processing time: ${chalk.blue(elapsedTime)}ms`),
      );
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

main();
