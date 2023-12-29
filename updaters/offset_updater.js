import fs, { promises as file } from 'fs'
import chalk from 'chalk'
import { findMethodType } from '../ClassUtils/method-types.js'
import { check } from '../ClassUtils/check.js'
import { getMethodOffsets, getTypes } from '../ClassUtils/process.js'
import {
  getOffsetsFromClass,
  navigateMethods,
  determineMethodType,
  getIndexForOffset,
  checkObfuscation,
  getOffsetByMethodName,
  getClassNameByOffset,
  isClassNameDuplicated,
  isClassNameObfuscated,
} from '../ClassUtils/methodNavigation.js'
import { classInfo } from '../structures/class_utils.js'
import { string } from '../structures/string_utils.js'
import { lib } from '../structures/lib_utils.js'

const configPath = !fs.existsSync('dev/config.json')
  ? 'config/config.json'
  : 'dev/config.json'
const str = new string()
const error = chalk.red
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const {
  JUDSN = config.JUDSN,
  LOGGING = config.LOGGING,
  CHECK_TYPE = config.CHECK_TYPE,
  COMPARE_HEX = config.COMPARE_HEX,
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
const newDump = new classInfo(OLD_DUMP_PATH)

/**
 * Check if a file contains any offsets.
 * @param {string} filePath - Path to the file.
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

/**
 * Reads offsets from a file and parses them into an object.
 * @returns {Promise<{ offset: string, offset2?: string, offset3?: string, name: string }>} Object containing offsets and name.
 * @throws {Error} If there is an error reading the offsets file.
 */
async function readOffsetsFromFileTest() {
  try {
    const data = await file.readFile(OFFSET_FILE, 'utf-8')

    if (data === '' || !containsOffsets(data)) {
      console.error(chalk.red('You must actually have offsets in offsets.txt'))
      process.exit()
    }

    const lines = data.trim().split('\n')
    const line = lines[0] // Assuming you only want to process the first line

    const [offsets, name] = line.split('--')
    const offsetNumbers = offsets
      .trim()
      .split(' ')
      .map(str => str.trim())

    return {
      offset: `${offsetNumbers[0]}`,
      offset2: offsetNumbers.length > 1 ? `${offsetNumbers[1]}` : '',
      offset3: offsetNumbers.length > 2 ? `${offsetNumbers[2]}` : '',
      name: name.trim(),
    }
  } catch (error) {
    throw new Error(`Error reading offsets file: ${error}`)
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
    const readStream = fs.createReadStream(filePath)
    const chunks = []

    for await (const chunk of readStream) {
      chunks.push(chunk)
    }

    const data = Buffer.concat(chunks)

    if (LOGGING) {
      const elapsedTime = (process.hrtime()[1] / 1e6).toFixed(3)
      console.log(chalk.gray(`readLibraryFile: ${elapsedTime}ms`))
    }

    return data
  } catch (error) {
    throw new Error(`Error reading library file: ${error}`)
  }
}

function getHexFromValidAddresses(validAddresses, libraryData) {
  const hexData = []

  validAddresses.forEach(address => {
    const offset = parseInt(address, 16)
    const hexSlice = libraryData.slice(offset, offset + OLD_HEX_LENGTH)
    hexData.push({ offset, hex: hexSlice.toString('hex') })
  })

  return hexData
}

function findClosestMatch(
  segment,
  patternBytes,
  firstCharacter,
  validOffsets,
  hexIndex,
) {
  const patternLength = patternBytes.length
  const lastOccurrence = getLastOccurrence(patternBytes)

  let closestMatch = null
  let minDistance = Infinity
  let iterationCount = 0

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

    if (COMPARE_HEX && hexIndex !== undefined) {
      for (const item of hexIndex) {
        if (segment[item.index] === item.char) {
          continue
        }
      }
    }

    iterationCount++

    const slice = segment.slice(i, i + patternLength)

    // Batch conversion of slice to hex for valid character set check
    const sliceHex = slice.toString('hex').toLowerCase()
    if (!isValidCharacterSet(sliceHex)) {
      i++
      continue
    }

    const firstNSame = slice
      .slice(0, N_INDEX)
      .equals(patternBytes.slice(0, N_INDEX))
    if (FIRST_N_SAME && !firstNSame) {
      i++
      continue
    }

    const distance = patternDistance(patternBytes.toString('hex'), sliceHex)
    if (distance < minDistance) {
      minDistance = distance
      closestMatch = slice
    }

    // Move the index using the Boyer-Moore heuristic
    i += patternLength - lastOccurrence[segment[i + patternLength - 1]]
  }

  return { closestMatch, iterationCount }
}

function getLastOccurrence(patternBytes) {
  const lastOccurrence = new Array(256).fill(-1)

  for (let i = 0; i < patternBytes.length - 1; i++) {
    lastOccurrence[patternBytes[i]] = i
  }

  return lastOccurrence
}

function isValidCharacterSet(sliceHex) {
  const validCharacterSet = /^[0-9a-fA-F]+$/
  return validCharacterSet.test(sliceHex)
}

/**
 * Calculates the pattern distance between two buffers.
 * @param {Buffer} pattern - The pattern to compare.
 * @param {Buffer} segment - The segment to compare against.
 * @returns {number} The pattern distance.
 */
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

  const lib2 = new lib(LIB_2) // : { content: 'what' }
  const lib3 = COMPARE_HEX ? (fs.existsSync(LIB_3) ? new lib(LIB_3) : '') : ''

  async function processOffset(
    offsetObj,
    remainingOffsets,
    currentNewLibraryData,
  ) {
    try {
      const { offset, offset2, offset3, name } = offsetObj
      const firstCharacter = oldLibraryData[offset]
      const oldMemorySlice = oldLibraryData.slice(
        offset,
        offset + OLD_MEMORY_SLICE_SIZE,
      )

      const oldHex = oldLibraryData.slice(offset, offset + OLD_HEX_LENGTH)

      const hexArgs = [
        oldHex.toString('hex'),
        lib2.offsetToHex(offset2.toString(16)).toString('hex'),
        //  secondHex:
        //   offset2 !== undefined
        //lib2.offsetToHex(offset2.toString(16))
        //    : undefined,
      ]

      if (offset3 !== undefined) {
        hexArgs.thirdHex = lib3
          .content()
          .toString('hex')
          .slice(offset3, offset3 + OLD_HEX_LENGTH)
      }

      const hexIndex = str.compareStrings(hexArgs)
      /*hexArgs.secondHex !== undefined && hexArgs.thirdHex !== undefined
          ? str.compareStrings(hexArgs)*/
      //  : undefined
      console.log(hexIndex)
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
        const methodStatus = {
          obfuscated: oldDump.isObfuscated(methodName),
          name: methodName,
        }
        const classStatus = {
          obfuscated: oldDump.isObfuscated(className),
          name: className,
        }
        const methodOffsets = getMethodOffsets(NEW_DUMP_PATH, {
          offsetStartChar: firstOffsetChar,
          methodType: offsetMethod,
          returnType: offsetTypes,
        }).offsets
        const { closestMatch, iterationCount, status } = findClosestMatch(
          currentNewLibraryData.slice(searchStartIndex),
          oldMemorySlice,
          firstCharacter,
          methodOffsets,
          hexIndex,
        )
        /*oldDump.isObfuscated(
          className,
        )
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
              status: true,
            }
          : /*(oldDump.isObfuscated(methodName) === false && oldDump.countOccurrences(methodName) === 1)
  ? {
      closestMatch: newDump.getOffsetByMethodName(methodName),
      iterationCount: 1,
      status: true
    }
  : */
        const endTime = process.hrtime(startTime)

        if (closestMatch) {
          const newOffset = currentNewLibraryData.indexOf(closestMatch)

          if (CHECK_TYPE) {
            const [oldType, newType, validNew] = await Promise.all([
              oldDump.getOffsetInfo(offset).methodType +
                oldDump.getOffsetInfo(offset).returnType,
              newDump.getOffsetInfo(newOffset).methodType +
                newDump.getOffsetInfo(newOffset).returnType,
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
                  error(!validNew ? 'not in cs' : ''),
                )

                retryCounter++

                if (retryCounter < MAX_ITERATIONS) {
                  console.log(
                    chalk.yellow(
                      `Retrying (${retryCounter}/${MAX_ITERATIONS})...`,
                    ),
                  )
                  return attemptOffset(newOffset + 1)
                } else {
                  console.log(
                    chalk.red(
                      `Max retry attempts reached for offset: 0x${offset
                        .toString(16)
                        .toUpperCase()}`,
                    ),
                  )
                  return
                }
              } else {
                console.log(
                  chalk.green('[TYPE_STATUS] - Passed ') + oldType.methodType,
                  oldType.returnType + ' => ' + newType.methodType,
                  newType.returnType,
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
            const elapsedTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(
              3,
            )
            console.log(
              chalk.green(
                `Found offset: ${chalk.blue(
                  `0x${offset.toString(16)}`,
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
              return
            }
          }
        }
      }

      await attemptOffset()
    } catch (error) {
      const errorDetails =
        error instanceof Error ? error.stack || error.message : String(error)
      console.error(
        chalk.red(
          `Error finding offset: 0x${offsetObj.offset.toString(
            16,
          )} - ${errorDetails}`,
        ),
      )
      process.abort()
    }
  }

  for (const offsetObj of oldOffsets) {
    await processOffset(offsetObj, oldOffsets.slice(1), newLibraryData)
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
  readOffsetsFromFileTest,
}
