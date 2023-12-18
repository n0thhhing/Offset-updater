import fs, { promises as file } from "fs";
import chalk from "chalk";
import { findMethodType } from "./Functions/method-types.js"

/**
 * Configuration object containing various parameters for the script.
 * @type {{
 *   JUDSN: boolean,                // If true, generates JUDSN-specific output.
 *   LOGGING: boolean,              // If true, logs execution times of functions.
 *   CHECK_TYPE: boolean            // If true, it will verify that the new offsets type matches
 *   OLD_DUMP_PATH: string          // Path to the old file containing offset methods
 *   NEW_DUMP_PATH: string          // Path to the new file containing offset methods
 *   OFFSET_FILE: string,           // Path to the file containing offsets.
 *   OLD_LIBRARY_PATH: string,      // Path to the old library file.
 *   NEW_LIBRARY_PATH: string,      // Path to the new library file.
 *   OUTPUT_FILE: string,           // Path to the output file.
 *   OLD_MEMORY_SLICE_SIZE: number, // Size of the memory slice for the old library.
 *   OFFSET_PADDING: number,        // Padding for offset formatting in the output.
 *   OLD_HEX_LENGTH: number,        // Length of the hex string in the old library.
 *   FIRST_CHAR_SAME: boolean       // If true, skips iterations if the first character doesn't match.
 * }}
 */
const config = {
  JUDSN: false,
  LOGGING: true,
  CHECK_TYPE: true,
  OLD_DUMP_PATH: "dump/old.cs",
  NEW_DUMP_PATH: "dump/new.cs",
  OFFSET_FILE: "offsets.txt",
  OLD_LIBRARY_PATH: "libs/old.so",
  NEW_LIBRARY_PATH: "libs/new.so",
  OUTPUT_FILE: "dist/output.txt",
  OLD_MEMORY_SLICE_SIZE: 400,
  OFFSET_PADDING: 100,
  OLD_HEX_LENGTH: 64,
  FIRST_CHAR_SAME: true,
};


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
    const data = await file.readFile(config.OFFSET_FILE, "utf-8");
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

    if (config.LOGGING) {
      const elapsedTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(3);
      console.log(chalk.gray(`readLibraryFile: ${elapsedTime}ms`));
    }

    return data;
  } catch (error) {
    throw new Error(`Error reading library file: ${error.message}`);
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
    if (config.FIRST_CHAR_SAME && firstCharacter !== segment[i]) {
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

  await Promise.all(
    oldOffsets.map(async ({ offset, name }) => {
      try {
        const firstCharacter = oldLibraryData[offset];
        const oldMemorySlice = oldLibraryData.slice(
          offset,
          offset + config.OLD_MEMORY_SLICE_SIZE,
        );
        const oldHex = oldLibraryData.slice(
          offset,
          offset + config.OLD_HEX_LENGTH,
        );

        const startTime = process.hrtime();
        const { closestMatch, iterationCount } = findClosestMatch(
          newLibraryData,
          oldMemorySlice,
          firstCharacter,
        );
        const endTime = process.hrtime(startTime);

        if (closestMatch) {
          const newOffset = newLibraryData.indexOf(closestMatch);

          // Check if type matching is enabled
          if (config.CHECK_TYPE) {
            const [oldType, newType] = await Promise.all([
              findMethodType(config.OLD_DUMP_PATH, offset),
              findMethodType(config.NEW_DUMP_PATH, newOffset),
            ]);

            if (oldType && newType && oldType !== newType) {
              results.push({
                oldOffset: offset,
                closestMatch: closestMatch.toString("hex"),
                newOffset: newOffset,
                iterationCount: iterationCount,
                name,
                oldHex: oldHex.toString("hex"),
                failedTypeCheck: true,
              });

              if (config.LOGGING) {
                const elapsedTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(3);
                console.log(
                  chalk.green(
                    `Found offset: ${chalk.blue(
                      `0x${offset.toString(16)}`,
                    )} in the new library => ${chalk.blue(
                      `0x${newOffset.toString(16).toUpperCase()}`,
                    )} (${name ? name + "" : ""})${chalk.grey(
                      ` - ${elapsedTime}ms - [Failed type check]`,
                    )}`,
                  ),
                );
              }
            } else {
              if (config.LOGGING) {
                const elapsedTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(3);
                console.log(
                  chalk.green(
                    `Found offset: ${chalk.blue(
                      `0x${offset.toString(16)}`,
                    )} in the new library => ${chalk.blue(
                      `0x${newOffset.toString(16).toUpperCase()}`,
                    )} (${name ? name + "" : ""})${chalk.grey(
                      ` - ${elapsedTime}ms`,
                    )}`,
                  ),
                );
              }
            }
          }
        } else {
          if (config.LOGGING) {
            console.log(
              chalk.yellow(
                `Could not find a match for offset: 0x${offset.toString(16)}`,
              ),
            );
          }
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

  if (config.LOGGING) {
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
        const offsetHeader = config.JUDSN
          ? `I[${count++}] = 0x${newOffset.toString(16).toUpperCase()}`
          : `Offset: 0x${oldOffset.toString(16).toUpperCase()}${" ".repeat(
              config.OFFSET_PADDING - oldOffset.toString(16).length,
            )}`;

        const matchDetails = config.JUDSN
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

    await file.writeFile(
      config.OUTPUT_FILE,
      config.JUDSN ? `I = {}\n${data}` : data,
    );

    console.log(
      chalk.green(`Offsets written to ${chalk.blue(config.OUTPUT_FILE)}`),
    );
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
    const oldLibraryData = await readLibraryFile(config.OLD_LIBRARY_PATH);
    const newLibraryData = await readLibraryFile(config.NEW_LIBRARY_PATH);

    const results = await findOffsetsInNewLibrary(
      oldOffsets,
      oldLibraryData,
      newLibraryData,
    );

    await writeOffsetsToFile(results);

    if (config.LOGGING) {
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