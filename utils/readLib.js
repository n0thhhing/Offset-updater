import fs from 'fs'
import chalk from 'chalk'
import { performance } from 'perf_hooks'

export async function readLibraryFile(filePath) {
  const startTime = process.hrtime()

  try {
    const stats = await fs.promises.stat(filePath)
    const fileSizeInBytes = stats.size
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(3)

    const data = await fs.promises.readFile(filePath)
    const elapsedTime = (process.hrtime(startTime)[1] / 1e6).toFixed(3)

    console.log(
      chalk.gray(
        `readLibraryFile(${filePath}): ${elapsedTime}ms, File Size: ${fileSizeInMB} MB`,
      ),
    )

    return data
  } catch (err) {
    throw new Error(`Error reading library file: ${err}`)
  }
}

export async function readLibraryFileOriginal(filePath) {
  const startTime = process.hrtime()

  try {
    const data = await fs.promises.readFile(filePath)
    const fileSizeInBytes = data.length
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(3)
    const elapsedTime = (process.hrtime(startTime)[1] / 1e6).toFixed(3)

    console.log(
      chalk.gray(
        `readLibraryFileOriginal(${filePath}): ${elapsedTime}ms, File Size: ${fileSizeInMB} MB`,
      ),
    )

    return data
  } catch (err) {
    throw new Error(`Error reading library file: ${err}`)
  }
}

async function benchmark() {
  const filePath = 'libs/new.so'

  console.log('Benchmarking...')
  const startOriginal = process.hrtime()
  await readLibraryFileOriginal(filePath)
  const elapsedOriginal = process.hrtime(startOriginal)[1] / 1e6
  console.log(`Original Function Elapsed Time: ${elapsedOriginal.toFixed(3)}ms`)

  const startOptimized = process.hrtime()
  await readLibraryFileOptimized(filePath)
  const elapsedOptimized = process.hrtime(startOptimized)[1] / 1e6
  console.log(
    `Optimized Function Elapsed Time: ${elapsedOptimized.toFixed(3)}ms`,
  )
}

//benchmark();
