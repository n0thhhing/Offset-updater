import fs from 'fs'
import chalk from 'chalk'
import {
  config,
  findOffsetsInNewLibrary,
  readLibraryFile,
  writeOffsetsToFile,
  readOffsetsFromFile,
  readOffsetsFromFileTest,
} from './updaters/offset_updater.js'

const error = chalk.red
const {
  JUDSN = config.JUDSN,
  LOGGING = config.LOGGING,
  CHECK_TYPE = config.CHECK_TYPE,
  paths: {
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

async function main() {
  try {
    const requiredFiles = [
      OLD_LIBRARY_PATH,
      OLD_DUMP_PATH,
      NEW_DUMP_PATH,
      OFFSET_FILE,
      OUTPUT_FILE,
      ,
      NEW_LIBRARY_PATH,
    ]

    requiredFiles.forEach(filePath => {
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${chalk.red(filePath)}`)
        process.exit(1)
      }
    })

    const startTime = process.hrtime()
    const [oldOffsets, oldLibraryData, newLibraryData, extraOffsets] =
      await Promise.all([
        readOffsetsFromFile(),
        readLibraryFile(OLD_LIBRARY_PATH),
        readLibraryFile(NEW_LIBRARY_PATH),
        readOffsetsFromFileTest(OFFSET_FILE),
      ])

    const results = await findOffsetsInNewLibrary(
      oldOffsets,
      oldLibraryData,
      newLibraryData,
    )

    await writeOffsetsToFile(results)

    if (LOGGING) {
      const endTime = process.hrtime(startTime)
      const elapsedTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2)
      console.log(
        chalk.gray(`Total processing time: ${chalk.blue(elapsedTime)}ms`),
      )
    }
  } catch (error) {
    console.error(`Error: ${chalk.red(error.message)}`)
  }
}

main()
