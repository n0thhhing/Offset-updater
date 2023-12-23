import * as fs, { promises as file } from 'fs'
import chalk from 'chalk'
import { findMethodType } from "../Functions/method-types.js";
import { check } from "../Functions/check.js";

/**
 * Interface representing an offset with an optional name.
 */
interface Offset {
  offset: number
  name?: string
}

/**
 * Interface representing the configuration options.
 */
interface Config {
  JUDSN: boolean
  LOGGING: boolean
  CHECK_TYPE: boolean
  OLD_DUMP_PATH: string
  NEW_DUMP_PATH: string
  OFFSET_FILE: string
  OLD_LIBRARY_PATH: string
  NEW_LIBRARY_PATH: string
  OUTPUT_FILE: string
  OLD_MEMORY_SLICE_SIZE: number
  OFFSET_PADDING: number
  OLD_HEX_LENGTH: number
  N_INDEX: number
  MAX_ITERATIONS: number
  FIRST_CHAR_SAME: boolean
  FIRST_N_SAME: boolean
}

// Configuration options
const config: Config = JSON.parse(
  fs.readFileSync('./config/config.json', 'utf8')
)

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
  N_INDEX,
  MAX_ITERATIONS,
  FIRST_CHAR_SAME,
  FIRST_N_SAME,
} = config

/**
 * Checks if a given string contains any offsets.
 * @param {string} fileData - The content of the file.
 * @returns {Promise<boolean>} - Promise resolving to true if offsets are found, false otherwise.
 */
async function containsOffsets(fileData: string): Promise<boolean> {
  try {
    const hexPattern: RegExp = /\b0x[0-9a-fA-F]+\b/g
    return hexPattern.test(fileData)
  } catch (error: any) {
    console.error(`Error reading file: ${error.message}`)
    return false
  }
}

/**
 * Reads offsets from a file and parses them into an array of objects.
 * @returns {Promise<Array<Offset>>} - Array of offset objects.
 * @throws {Error} - If there is an error reading the offsets file.
 */
async function readOffsetsFromFile(): Promise<Array<Offset>> {
  try {
    const data: string = await file.readFile(OFFSET_FILE, 'utf-8')
    if (data === '' || !containsOffsets(data)) {
      console.error(chalk.red('You must actually have offsets in offsets.txt'))
      process.exit()
    }
    return data
      .trim()
      .split('\n')
      .map((line) => {
        const [offsetStr, name] = line.split('--').map((str) => str.trim())
        return { offset: parseInt(offsetStr.trim(), 16), name }
      })
  } catch (error: any) {
    throw new Error(`Error reading offsets file: ${error.message}`)
  }
}

/**
 * Reads the content of a library file and logs the execution time if logging is enabled.
 * @param {string} filePath - Path to the library file.
 * @returns {Promise<Buffer>} - The content of the library file as a Buffer.
 * @throws {Error} - If there is an error reading the library file.
 */
async function readLibraryFile(filePath: string): Promise<Buffer> {
  try {
    const readStream = fs.createReadStream(filePath)
    const chunks: Array<Buffer> = []

    for await (const chunk of readStream) {
      chunks.push(chunk)
    }

    const data = Buffer.concat(chunks)

    if (LOGGING) {
      const elapsedTime = (process.hrtime()[1] / 1e6).toFixed(3)
      console.log(chalk.gray(`readLibraryFile: ${elapsedTime}ms`))
    }

    return data
  } catch (error: any) {
    throw new Error(`Error reading library file: ${error.message}`)
  }
}

/**
 * Finds the closest matching segment in the new library based on the old library segment and pattern bytes.
 * @param {Buffer} segment - The segment to search within.
 * @param {Buffer} patternBytes - The pattern to search for.
 * @param {string} firstCharacter - The first character of the old library segment.
 * @returns {Object} - Object containing the closest matching segment and iteration count.
 */
function findClosestMatch(
  segment: Buffer,
  patternBytes: Buffer,
  firstCharacter: string
): { closestMatch: Buffer | null; iterationCount: number } {
  const patternLength: number = patternBytes.length
  const lastOccurrence: Array<number> = getLastOccurrence(patternBytes)

  let closestMatch: Buffer | null = null
  let minDistance: number = Infinity
  let iterationCount: number = 0

  // Early exit if pattern length is greater than segment length
  if (patternLength > segment.length) {
    return { closestMatch, iterationCount }
  }

  for (let i = 0; i < segment.length - patternLength + 1; ) {
    // Skip iterations if the first character doesn't match
    if (FIRST_CHAR_SAME && firstCharacter !== segment[i]) {
      i++
      continue
    }

    iterationCount++

    const slice: Buffer = segment.slice(i, i + patternLength)

    // Batch conversion of slice to hex for valid character set check
    const sliceHex: string = slice.toString('hex').toLowerCase()
    if (!isValidCharacterSet(sliceHex)) {
      i++
      continue
    }

    const firstNSame: boolean = slice
      .slice(0, N_INDEX)
      .equals(patternBytes.slice(0, N_INDEX))
    if (FIRST_N_SAME && !firstNSame) {
      i++
      continue
    }

    const distance: number = patternDistance(
      patternBytes.toString('hex'),
      sliceHex
    )
    if (distance < minDistance) {
      minDistance = distance
      closestMatch = slice
    }

    // Move the index using the Boyer-Moore heuristic
    i += patternLength - lastOccurrence[segment[i + patternLength - 1]]
  }

  return { closestMatch, iterationCount }
}

/**
 * Retrieves the last occurrence indices of each byte in the pattern.
 * @param {Buffer} patternBytes - The pattern to find occurrences for.
 * @returns {Array<number>} - Array containing the last occurrence indices.
 */
function getLastOccurrence(patternBytes: Buffer): Array<number> {
  const lastOccurrence: Array<number> = new Array(256).fill(-1)

  for (let i = 0; i < patternBytes.length - 1; i++) {
    lastOccurrence[patternBytes[i]] = i
  }

  return lastOccurrence
}

/**
 * Checks if a given hex string represents a valid character set.
 * @param {string} sliceHex - The hex string to check.
 * @returns {boolean} - True if the hex string represents a valid character set, false otherwise.
 */
function isValidCharacterSet(sliceHex: string): boolean {
  const validCharacterSet: RegExp = /^[0-9a-fA-F]+$/
  return validCharacterSet.test(sliceHex)
}

/**
 * Calculates the pattern distance between two buffers.
 * @param {Buffer} pattern - The pattern to compare.
 * @param {Buffer} segment - The segment to compare against.
 * @returns {number} The pattern distance.
 */
function patternDistance(pattern: Buffer, segment: string): number {
  let distance: number = 0

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== segment[i]) {
      distance++

      // Penalty for non-matching characters at corresponding positions
      distance += getCharacterDistancePenalty(pattern[i], segment[i])
    }
  }

  return distance
}

/**
 * Calculates the penalty for character distance based on their types.
 * @param {string} char1 - The first character.
 * @param {string} char2 - The second character.
 * @returns {number} - The penalty for character distance.
 */
function getCharacterDistancePenalty(char1: string, char2: string): number {
  const isAlpha1: boolean = isAlphabetic(char1)
  const isAlpha2: boolean = isAlphabetic(char2)

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

/**
 * Checks if a given character is alphabetic.
 * @param {string} char - The character to check.
 * @returns {boolean} - True if the character is alphabetic, false otherwise.
 */
function isAlphabetic(char: string): boolean {
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
  oldOffsets: Array<Offset>,
  oldLibraryData: Buffer,
  newLibraryData: Buffer
): Promise<Array<Object>> {
  const results: Array<Object> = []
  const cpuStart: NodeJS.CpuUsage = process.cpuUsage()

  async function processOffset(
    offsetObj: Offset,
    remainingOffsets: Array<Offset>,
    currentNewLibraryData: Buffer
  ): Promise<void> {
    try {
      const { offset, name } = offsetObj
      const firstCharacter: string = oldLibraryData[offset]
      const oldMemorySlice: Buffer = oldLibraryData.slice(
        offset,
        offset + OLD_MEMORY_SLICE_SIZE
      )

      const oldHex: Buffer = oldLibraryData.slice(
        offset,
        offset + OLD_HEX_LENGTH
      )

      let retryCounter: number = 0
      const attemptOffset = async (
        searchStartIndex: number = 0
      ): Promise<void> => {
        const startTime: [number, number] = process.hrtime()
        const {
          closestMatch,
          iterationCount,
          status,
        }: {
          closestMatch: Buffer | null
          iterationCount: number
          status: string
        } = findClosestMatch(
          currentNewLibraryData.slice(searchStartIndex),
          oldMemorySlice,
          firstCharacter
        )
        const endTime: [number, number] = process.hrtime(startTime)

        if (closestMatch) {
          const newOffset: number = currentNewLibraryData.indexOf(closestMatch)

          if (CHECK_TYPE) {
            const [oldType, newType, validNew]: [any, any, boolean] =
              await Promise.all([
                findMethodType(OLD_DUMP_PATH, offset),
                findMethodType(NEW_DUMP_PATH, newOffset),
                check(newOffset, NEW_DUMP_PATH),
              ])

            if (oldType && newType) {
              if (
                !validNew ||
                oldType.returnType !== newType.returnType ||
                oldType.methodType !== newType.methodType
              ) {
                console.log(
                  chalk.red('[TYPE_STATUS] - Failed ') +
                    '0x' +
                    offset.toString(16).toUpperCase(),
                  oldType.methodType,
                  oldType.returnType + ' => ' + newType.methodType,
                  newType.returnType +
                    ' 0x' +
                    newOffset.toString(16).toUpperCase() +
                    ' ' +
                    chalk.blue(name ? name + '' : ''),
                  chalk.red(!validNew ? 'not in cs' : '')
                )

                retryCounter++

                if (retryCounter < MAX_ITERATIONS) {
                  console.log(
                    chalk.yellow(
                      `Retrying (${retryCounter}/${MAX_ITERATIONS})...`
                    )
                  )
                  return attemptOffset(newOffset + 1)
                } else {
                  console.log(
                    chalk.red(
                      `Max retry attempts reached for offset: 0x${offset
                        .toString(16)
                        .toUpperCase()}`
                    )
                  )
                  return
                }
              } else {
                console.log(
                  chalk.green('[TYPE_STATUS] - Passed ') + oldType.methodType,
                  oldType.returnType + ' => ' + newType.methodType,
                  newType.returnType
                )
              }
            } else {
              console.error(chalk.red('[TYPE_STATUS] - Error fetching types'))
              return
            }
          }

          results.push({
            oldOffset: offset,
            closestMatch: closestMatch.toString('hex'),
            newOffset: newOffset,
            iterationCount: iterationCount,
            name,
            oldHex: oldHex.toString('hex'),
          })

          if (LOGGING) {
            const elapsedTime: string = (
              endTime[0] * 1000 +
              endTime[1] / 1e6
            ).toFixed(3)
            console.log(
              chalk.green(
                `Found offset: ${chalk.blue(
                  `0x${offset.toString(16)}`
                )} in the new library => ${chalk.blue(
                  `0x${newOffset.toString(16).toUpperCase()}`
                )} (${name ? name + '' : ''})${chalk.grey(
                  ` - ${elapsedTime}ms`
                )}`
              )
            )
          }
        } else {
          if (LOGGING) {
            console.log(
              chalk.yellow(
                `Could not find a match for offset: 0x${offset
                  .toString(16)
                  .toUpperCase()}`
              )
            )

            retryCounter++

            if (retryCounter < MAX_ITERATIONS) {
              console.log(
                chalk.yellow(`Retrying (${retryCounter}/${MAX_ITERATIONS})...`)
              )
              return attemptOffset()
            } else {
              console.log(
                chalk.red(
                  `Max retry attempts reached for offset: 0x${offset
                    .toString(16)
                    .toUpperCase()}`
                )
              )
              return
            }
          }
        }
      }

      await attemptOffset()
    } catch (error: any) {
      console.error(
        chalk.red(
          `Error finding offset: 0x${offsetObj.offset.toString(16)} - ${
            error.message
          }`
        )
      )
      process.abort()
    }
  }

  for (const offsetObj of oldOffsets) {
    await processOffset(offsetObj, oldOffsets.slice(1), newLibraryData)
  }

  const cpuEnd: NodeJS.CpuUsage = process.cpuUsage(cpuStart)
  const elapsedTime: number = cpuEnd.user / 1000

  if (LOGGING) {
    console.log(
      chalk.gray(
        `CPU Usage: ${chalk.blue(cpuEnd.user)}us User, ${chalk.blue(
          cpuEnd.system
        )}us System`
      )
    )
    console.log(
      chalk.gray(`Total elapsed time: ${chalk.blue(elapsedTime.toFixed(2))}ms`)
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
async function writeOffsetsToFile(results: Array<Object>): Promise<void> {
  try {
    let data: string = ''
    let count: number = 1

    results.forEach(
      ({
        oldOffset,
        closestMatch,
        newOffset,
        iterationCount,
        name,
        oldHex,
      }) => {
        const offsetHeader: string = JUDSN
          ? `I[${count++}] = 0x${newOffset.toString(16).toUpperCase()}`
          : `Offset: 0x${oldOffset.toString(16).toUpperCase()}${' '.repeat(
              OFFSET_PADDING - oldOffset.toString(16).length
            )}`

        const matchDetails: string = JUDSN
          ? name
            ? ` -- ${name}`
            : ''
          : `\n Closest match:\n  * OldHex: ${oldHex}\n  * Hex: ${closestMatch}\n  * Offset: 0x${newOffset
              .toString(16)
              .toUpperCase()}\n  * Iteration Count: ${iterationCount}\n${
              name ? `  * Name: ${name}\n` : ''
            }\n`

        data += `${offsetHeader}${matchDetails}\n`
      }
    )

    await file.writeFile(OUTPUT_FILE, JUDSN ? `I = {}\n${data}` : data)

    console.log(chalk.green(`Offsets written to ${chalk.blue(OUTPUT_FILE)}`))
  } catch (error: any) {
    throw new Error(`Error writing offsets to file: ${error.message}`)
  }
}

/**
 * Main function orchestrating the entire process.
 * @returns {Promise<void>} Promise indicating the completion of the main process.
 */
async function main(): Promise<void> {
  try {
    const startTime: [number, number] = process.hrtime()

    const [oldOffsets, oldLibraryData, newLibraryData]: [
      Array<Offset>,
      Buffer,
      Buffer,
    ] = await Promise.all([
      readOffsetsFromFile(),
      readLibraryFile(OLD_LIBRARY_PATH),
      readLibraryFile(NEW_LIBRARY_PATH),
    ])

    const results: Array<Object> = await findOffsetsInNewLibrary(
      oldOffsets,
      oldLibraryData,
      newLibraryData
    )

    await writeOffsetsToFile(results)

    if (LOGGING) {
      const endTime: [number, number] = process.hrtime(startTime)
      const elapsedTime: string = (
        endTime[0] * 1000 +
        endTime[1] / 1e6
      ).toFixed(2)
      console.log(
        chalk.gray(`Total processing time: ${chalk.blue(elapsedTime)}ms`)
      )
    }
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`))
  }
}

main()
