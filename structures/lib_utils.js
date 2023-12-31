import fs from 'fs'

class lib {
  constructor(filePath) {
    this.filePath = filePath
    this.libContent = this.readLibraryFile(this.filePath)
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
    const index = this.libContent.indexOf(hexBuffer)

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
      offsetNumber < this.libContent.length
    ) {
      const hexBuffer = this.libContent.slice(offsetNumber, offsetNumber + 50) // Assuming a fixed length of 16 bytes
      return hexBuffer.toString('hex')
    } else {
      throw new Error('Invalid offset address.')
    }
  }

  /**
   * Reads a library file and returns the hex
   * @param{string} filePath
   * @returns{hexBuffer} the libraries hex
  */
  readLibraryFile(filePath) {
    try {
      const data = fs.readFileSync(filePath)
      return data
    } catch (error) {
      throw new Error(`Error reading library file: ${error}`)
    }
  }

  async content() {
    return this.libContent
  }
}

export { lib }
