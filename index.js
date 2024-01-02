import fs from 'fs'
import chalk from 'chalk'
import {
  config,
  findOffsetsInNewLibrary,
  // readLibraryFile,
  writeOffsetsToFile,
  readOffsetsFromFile,
} from './updaters/offset_updater.js'
import { readLibraryFile } from './utils/readLib.js'

const error = chalk.red
const {
  LOGGING = config.LOGGING,
  paths: {
    OLD_DUMP_PATH = paths.OLD_DUMP_PATH,
    NEW_DUMP_PATH = paths.NEW_DUMP_PATH,
    OFFSET_FILE = paths.OFFSET_FILE,
    OLD_LIBRARY_PATH = paths.OLD_LIBRARY_PATH,
    NEW_LIBRARY_PATH = paths.NEW_LIBRARY_PATH,
    OUTPUT_FILE = paths.OUTPUT_FILE,
  },
} = config

async function main() {
  try {
    const requiredFiles = [
      OLD_LIBRARY_PATH,
      OLD_DUMP_PATH,
      NEW_DUMP_PATH,
      OFFSET_FILE,
      OUTPUT_FILE,
      NEW_LIBRARY_PATH,
    ]

    requiredFiles.forEach(filePath => {
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${chalk.red(filePath)}`)
        process.exit(1)
      }
    })

    const startTime = process.hrtime()
    const [oldOffsets, oldLibraryData, newLibraryData] = await Promise.all([
      readOffsetsFromFile(),
      readLibraryFile(OLD_LIBRARY_PATH),
      readLibraryFile(NEW_LIBRARY_PATH),
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
