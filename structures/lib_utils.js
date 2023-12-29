
class lib {
  constructor(filePath) {
    (async () => {
      this.content = await readLibraryFile(filePath);
    })();
  }
  /**
 * Converts a hex string to the offset address in the library data.
 * @param {string} hex - Hex string representing the data in the library.
 * @param {Buffer} libraryData - Content of the library data.
 * @returns {string} Offset address.
 * @throws {Error} If hex is not a valid hex string or if hex is not found in library data.
 */
hexToOffset(hex) {
  if (!/^[0-9A-Fa-f]+$/.test(hex)) {
    throw new Error('Invalid hex string.')
  }

  const hexBuffer = Buffer.from(hex, 'hex')
  const index = this.content.indexOf(hexBuffer)

  if (index !== -1) {
    return `0x${index.toString(16).toUpperCase()}`
  } else {
    throw new Error('Hex not found in library data.')
  }
}
/**
 * Converts an offset address to the hex string in the library data.
 * @param {string} offset - Offset address.
 * @param {Buffer} libraryData - Content of the library data.
 * @returns {string} Hex string representing the data in the library.
 */
offsetToHex(offset) {
  const offsetNumber = parseInt(offset, 16)

  if (
    !isNaN(offsetNumber) &&
    offsetNumber >= 0 &&
    offsetNumber < libraryData.length
  ) {
    const hexBuffer = this.content.slice(offsetNumber, offsetNumber + 16) // Assuming a fixed length of 16 bytes
    return hexBuffer.toString('hex')
  } else {
    throw new Error('Invalid offset address.')
  }
}

/**
 * Reads the content of a library file and logs the execution time if logging is enabled.
 * @param {string} filePath - Path to the library file.
 * @returns {Promise<Buffer>} The content of the library file as a Buffer.
 * @throws {Error} If there is an error reading the library file.
 */
async readLibraryFile(filePath) {
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

content() {
return this.content;
}
}