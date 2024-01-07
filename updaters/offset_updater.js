import fs, { promises as file } from 'fs'
import chalk from 'chalk'
import { getMethodOffsets } from '../utils/process.js'
import {
  getOffsetsFromClass,
  getIndexForOffset,
} from '../utils/methodNavigation.js'
import { readLibraryFile } from '../utils/readLib.js'
import { classInfo } from '../structures/class_utils.js'
import { string } from '../structures/string_utils.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const configPath = fs.existsSync('dev/config.json')
  ? '../dev/config.json'
  : '../config/config.json'
const str = new string()
const error = chalk.red
const config = require(configPath) //JSON.parse(fs.readFileSync(configPath, 'utf8'))
const {
  JUDSN = config.JUDSN,
  LOGGING = config.LOGGING,
  CHECK_TYPE = config.CHECK_TYPE,
  USE_DUMP = config.USE_DUMP,
  COMPARE_HEX = config.COMPARE_HEX,
  DEBUG = config.DEBUG,
  paths: {
    LIB_2 = paths.LIB_2,
    LIB_3 = paths.LIB_3,
    OLD_DUMP_PATH = paths.OLD_DUMP_PATH,
    NEW_DUMP_PATH = paths.NEW_DUMP_PATH,
    OFFSET_FILE = paths.OFFSET_FILE,
    OLD_LIBRARY_PATH = paths.OLD_LIBRARY_PATH,
    NEW_LIBRARY_PATH = paths.NEW_LIBRARY_PATH,
    OUTPUT_FILE = paths.OUTPUT_FILE,
  },
  counts: {
    OLD_MEMORY_SLICE_SIZE = counts.OLD_MEMORY_SLICE_SIZE,
    OFFSET_PADDING = counts.OFFSET_PADDING,
    OLD_HEX_LENGTH = counts.OLD_HEX_LENGTH,
    N_INDEX = counts.N_INDEX,
    MAX_ITERATIONS = counts.MAX_ITERATIONS,
  },
  FIRST_CHAR_SAME = config.FIRST_CHAR_SAME,
  FIRST_N_SAME = config.FIRST_N_SAME,
} = config
const oldDump = new classInfo(OLD_DUMP_PATH)
const newDump = new classInfo(NEW_DUMP_PATH)

/**
 * Check if a file contains any offsets.
 * @param {string} fileData - Path to the file.
 * @returns {Promise<boolean>} - Promise resolving to true if offsets are found, false otherwise.
 */
async function containsOffsets(fileData) {
  try {
    // Regular expression to match hexadecimal numbers
    const hexPattern = /\b0x[0-9a-fA-F]+\b/g
    return hexPattern.test(fileData)
  } catch (error) {
    console.error(`Error reading file: ${error}`)
    return false
  }
}

/**
 * Reads offsets from a file and parses them into an array of objects.
 * @returns {Promise<Array<{ offset: number, offset2: number, offset3: number, name?: string }>>} Array of offset objects.
 * @throws {Error} If there is an error reading the offsets file.
 */
async function readOffsetsFromFile() {
  try {
    const startTime = process.hrtime()
    const data = await file.readFile(OFFSET_FILE, 'utf-8')
    if (data === '' || !containsOffsets(data)) {
      console.error(chalk.red('You must actually have offsets in offsets.txt'))
      process.exit()
    }

    return data
      .trim()
      .split('\n')
      .map(line => {
        const [offsetStr, name] = line.split('--').map(str => str.trim())
        const [offset, offset2, offset3] = offsetStr
          .split(' ')
          .map(str => str.trim())

        const parsedOffset2 =
          offset2 !== undefined ? parseInt(offset2, 16) : undefined
        const parsedOffset3 =
          offset3 !== undefined ? parseInt(offset3, 16) : undefined

        if (LOGGING) {
          const elapsedTime = (process.hrtime(startTime)[1] / 1e6).toFixed(3)
          console.log(chalk.gray(`readOffsetsFromFile: ${elapsedTime}ms`))
        }
        return {
          offset: parseInt(offset, 16),
          offset2: parsedOffset2,
          offset3: parsedOffset3,
          name,
        }
      })
  } catch (error) {
    throw new Error(`Error reading offsets file: ${error}`)
  }
}

function isValidCharacterSet(sliceHex) {
  const validCharacterSet = /^[0-9a-fA-F]+$/
  return validCharacterSet.test(sliceHex)
}

function findClosestMatch(
  segment,
  patternBytes,
  firstCharacter,
  validOffsets,
  charIndexes,
) {
  const patternLength = patternBytes.length;
  const lastOccurrence = getLastOccurrence(patternBytes);
  const patternBytesN = patternBytes.slice(0, N_INDEX);

  let closestMatch = null;
  let minDistance = Infinity;
  let iterationCount = 0;

  if (patternLength > segment.length) {
    return { closestMatch, iterationCount };
  }

  const segmentLength = segment.length - patternLength + 1;
  const validCharacterSet = /^[0-9a-fA-F]+$/;
  const patternHex = patternBytes.toString('hex');
  const segmentHex = segment.toString('hex');
  const validCharacterSets = segmentHex.match(/([0-9a-fA-F]+)/g) || [];

  let i = 0;

  for (; i < segmentLength; ) {
    if (FIRST_CHAR_SAME && firstCharacter !== segment[i]) {
      i++;
      continue;
    }

    iterationCount++;

    const slice = segment.slice(i, i + patternLength);
    const sliceHex = segmentHex.slice(2 * i, 2 * (i + patternLength));

    if (
      !validCharacterSet.test(sliceHex) ||
      (FIRST_N_SAME && !slice.slice(0, N_INDEX).equals(patternBytesN))
    ) {
      i++;
      continue;
    }

    const distance = patternDistance(patternHex, sliceHex);

    if (distance === 0) {
      return { closestMatch: slice, iterationCount };
    }

    if (iterationCount === 1 && DEBUG) {
      console.log(
        `${chalk.red('[DEBUG] -')} (Start) ${chalk.green(
          `Iteration ${chalk.blue(iterationCount)}: Index ${chalk.blue(i)}`,
        )}`,
      );
    }

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = slice;
    }

    const skip = patternLength - lastOccurrence[slice[patternLength - 1]] || 1;
    i += Math.max(1, skip);
  }

  console.log(
    `${chalk.red('[DEBUG] -')} (End) ${chalk.green(
      `Iteration ${chalk.blue(iterationCount)}: Index ${chalk.blue(i)}`,
    )}`,
  );

  return { closestMatch, iterationCount };
}

// ... (rest of your code remains unchanged)

function generateSkipTable(patternBytes, lastOccurrence) {
  const skipTable = new Array(256).fill(patternBytes.length)

  for (let i = 0; i < patternBytes.length - 1; i++) {
    const char = patternBytes[i]
    skipTable[char] = Math.max(
      1,
      patternBytes.length - 1 - i + lastOccurrence[char],
    )
  }

  return skipTable
}

function getLastOccurrence(patternBytes) {
  const lastOccurrence = new Uint8Array(256).fill(-1)

  for (let i = 0; i < patternBytes.length - 1; i++) {
    lastOccurrence[patternBytes[i]] = i
  }

  return lastOccurrence
}

function patternDistance(pattern, segment) {
  let distance = 0

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== segment[i]) {
      distance++

      // Penalty for non-matching characters at corresponding positions
      distance += getCharacterDistancePenalty(pattern[i], segment[i])
    }
  }

  return distance
}

function getCharacterDistancePenalty(char1, char2) {
  const isAlpha1 = isAlphabetic(char1)
  const isAlpha2 = isAlphabetic(char2)

  if (isAlpha1 && isAlpha2) {
    // Both characters are alphabetic, apply a case-insensitive comparison
    if (char1.toLowerCase() !== char2.toLowerCase()) {
      return 1
    }
  } else if (isAlpha1 !== isAlpha2) {
    // Characters have different types, apply a larger penalty
    return 2
  } else {
    // Both characters are numeric, apply a normal comparison
    if (char1 !== char2) {
      return 1
    }
  }

  return 0
}
function isAlphabetic(char) {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
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
  const results = []
  const cpuStart = process.cpuUsage()

  async function processOffset(offsetObj, currentNewLibraryData) {
    const { offset, name, offset2, offset3 } = offsetObj
    const firstCharacter = oldLibraryData[offset]
    const oldMemorySlice = oldLibraryData.slice(
      offset,
      offset + OLD_MEMORY_SLICE_SIZE,
    )
    const oldHex = oldLibraryData.slice(offset, offset + OLD_HEX_LENGTH)
    const hexIndex = null //str.compareStrings([oldHex.toString("hex"), midHex.toString("hex")])//null
    //offset2 != undefined ? str.compareStrings(strings) : undefined
    // console.log(str.compareStrings([oldHex.toString("hex"), midHex.toString("hex")]))
    let retryCounter = 0

    const attemptOffset = async (searchStartIndex = 0) => {
      const offsetMethod = oldDump.getOffsetInfo(offset).methodType
      const offsetTypes = oldDump.getOffsetInfo(offset).returnType
      const methodName = oldDump.getMethodName(
        `0x${offset.toString(16).toUpperCase()}`,
      )
      const className = oldDump.getClassNameByOffset(
        `0x${offset.toString(16).toUpperCase()}`,
      )
      const startTime = process.hrtime()
      const firstOffsetChar = offset.toString(16).charAt(0)

      const methodOffsets = getMethodOffsets(NEW_DUMP_PATH, {
        offsetStartChar: firstOffsetChar,
        methodType: offsetMethod,
        returnType: offsetTypes,
      }).offsets
      const { closestMatch, iterationCount } =
        str.isObfuscated(className) && USE_DUMP
          ? {
              closestMatch: getOffsetsFromClass(
                NEW_DUMP_PATH,
                className,
                `0x${offset.toString(16).toUpperCase()}`,
              )[
                getIndexForOffset(
                  OLD_DUMP_PATH,
                  `0x${offset.toString(16).toUpperCase()}`,
                )
              ],
              iterationCount: 1,
            }
          : str.isObfuscated(methodName) === false &&
              oldDump.countOccurrences(methodName) === 1 &&
              USE_DUMP
            ? {
                closestMatch: newDump.getOffsetByMethodName(methodName),
                iterationCount: 1,
              }
            : findClosestMatch(
                currentNewLibraryData.slice(searchStartIndex),
                oldMemorySlice,
                firstCharacter,
                methodOffsets,
                offset2 != undefined ? hexIndex : null,
              )

      const endTime = process.hrtime(startTime)

      if (closestMatch) {
        const newOffset = currentNewLibraryData.indexOf(closestMatch)

        results.push({
          oldOffset: offset,
          closestMatch: closestMatch.toString('hex'),
          newOffset: newOffset,
          iterationCount: iterationCount,
          name,
          oldHex: oldHex.toString('hex'),
        })

        if (LOGGING) {
          const elapsedTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(3)
          const oldOffsetType = await oldDump.findMethodTypeBasic(
            '0x' + offset.toString(16).toUpperCase(),
          )
          const newOffsetType = await newDump.findMethodTypeBasic(
            '0x' + newOffset.toString(16).toUpperCase(),
          )
          const offsetChange = `${chalk.blue(oldOffsetType)} => ${chalk.blue(
            newOffsetType,
          )}`
          console.log(
            `${
              oldOffsetType === newOffsetType
                ? chalk.green(`[TYPE_CHECK] - Passed ${offsetChange}\n`)
                : chalk.red(`[TYPE_CHECK] - Failed ${offsetChange}\n`)
            }` +
              chalk.green(
                `Found offset: ${chalk.blue(
                  `0x${offset.toString(16).toUpperCase()}`,
                )} in the new library => ${chalk.blue(
                  `0x${newOffset.toString(16).toUpperCase()}`,
                )} (${name ? name + '' : ''})${chalk.grey(
                  ` - ${elapsedTime}ms`,
                )}`,
              ),
          )
        }
      } else {
        if (LOGGING) {
          console.log(
            chalk.yellow(
              `Could not find a match for offset: 0x${offset
                .toString(16)
                .toUpperCase()}`,
            ),
          )

          retryCounter++

          if (retryCounter < MAX_ITERATIONS) {
            console.log(
              chalk.yellow(`Retrying (${retryCounter}/${MAX_ITERATIONS})...`),
            )
            return attemptOffset()
          } else {
            console.log(
              chalk.red(
                `Max retry attempts reached for offset: 0x${offset
                  .toString(16)
                  .toUpperCase()}`,
              ),
            )
          }
        }
      }
    }
    await attemptOffset()
  }

  for (let i = 0; i < oldOffsets.length; i++) {
    await processOffset(oldOffsets[i], newLibraryData)
  }

  const cpuEnd = process.cpuUsage(cpuStart)
  const elapsedTime = cpuEnd.user / 1000

  if (LOGGING) {
    console.log(
      chalk.gray(
        `CPU Usage: ${chalk.blue(cpuEnd.user)}us User, ${chalk.blue(
          cpuEnd.system,
        )}us System`,
      ),
    )
    console.log(
      chalk.gray(`Total elapsed time: ${chalk.blue(elapsedTime.toFixed(2))}ms`),
    )
  }

  return results
}

/**
 * Writes offset details to a file.
 * @param {Array<Object>} results - Array of offset details.
 * @returns {Promise<void>} Promise indicating the completion of writing to the file.
 * @throws {Error} If there is an error writing to the file.
 */
async function writeOffsetsToFile(results) {
  try {
    let data = ''
    let count = 1

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
          : `Offset: 0x${oldOffset.toString(16).toUpperCase()}${' '.repeat(
              OFFSET_PADDING - oldOffset.toString(16).length,
            )}`

        const matchDetails = JUDSN
          ? name
            ? ` -- ${name}`
            : ''
          : `\n Closest match:\n  * OldHex: ${oldHex}\n  * Hex: ${closestMatch}\n  * Offset: 0x${newOffset
              .toString(16)
              .toUpperCase()}\n  * Iteration Count: ${iterationCount}\n${
              name ? `  * Name: ${name}\n` : ''
            }\n`

        data += `${offsetHeader}${matchDetails}\n`
      },
    )

    await file.writeFile(OUTPUT_FILE, JUDSN ? `I = {}\n${data}` : data)

    console.log(chalk.green(`Offsets written to ${chalk.blue(OUTPUT_FILE)}`))
  } catch (error) {
    throw new Error(`Error writing offsets to file: ${error}`)
  }
}

export {
  config,
  error,
  findOffsetsInNewLibrary,
  readLibraryFile,
  writeOffsetsToFile,
  readOffsetsFromFile,
  newDump,
  oldDump,
}
