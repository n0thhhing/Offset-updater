import file from 'fs/promises'
import fs from 'fs'

function findMethodType(DUMP_PATH, offset) {
  try {
    const dumpContent = fs.readFileSync(DUMP_PATH, 'utf-8')
    const regex =
      /\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x[0-9A-Fa-f]+ VA: 0x[0-9A-Fa-f]+\s+([a-zA-Z<>]+)\s+(.*?)\(/g

    let match
    let foundReturnType = null // To store the found return type
    let startIndex = 0

    while ((match = regex.exec(dumpContent)) !== null) {
      const currentOffset = parseInt(match[1], 16)
      const methodType = match[2].trim()
      let returnType = match[3].trim().split(/\s+/).slice(0, -1).join(' ')

      // Check for two-word return types
      if (returnType.startsWith('<') && returnType.endsWith('>')) {
        const secondWordIndex = returnType.indexOf(
          ' ',
          returnType.indexOf('>') + 1,
        )
        returnType = returnType.substring(
          returnType.indexOf('<') + 1,
          secondWordIndex !== -1 ? secondWordIndex : undefined,
        )
      }

      // Slice off everything after common types (void, bool, byte, etc.)
      const commonTypes = [
        'void',
        'bool',
        'byte',
        'char',
        'decimal',
        'double',
        'float',
        'int',
        'long',
        'object',
        'string',
      ]
      const commonTypeIndex = commonTypes.findIndex(type =>
        returnType.startsWith(type),
      )
      if (commonTypeIndex !== -1) {
        returnType = commonTypes[commonTypeIndex]
      }

      if (currentOffset === offset) {
        return { methodType, returnType }
      }

      // If one type is found and the other is not, store the found type
      if (!foundReturnType) {
        foundReturnType = returnType
      }

      startIndex = regex.lastIndex
    }

    // Return the found type if one is found and the other is not
    if (foundReturnType) {
      return { methodType: null, returnType: foundReturnType }
    }

    // Return null if the offset is not found and no type is found
    return null
  } catch (error) {
    console.error('Error reading the file:', error)
    return null
  }
}

// only returns basic types
async function findMethodTypeBasic(DUMP_PATH, offset) {
  try {
    const dumpContent = await file.readFile(DUMP_PATH, 'utf-8')

    const regex =
      /\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x[0-9A-Fa-f]+ VA: 0x[0-9A-Fa-f]+\s+(.*?)\(/g

    let match
    while ((match = regex.exec(dumpContent)) !== null) {
      const currentOffset = parseInt(match[1], 16)
      const methodType = match[2].trim()

      if (currentOffset === offset) {
        const basicTypeMatch = methodType.match(
          /\b(void|bool|byte|char|decimal|double|float|int|long|object|string)\b/,
        )
        return basicTypeMatch ? basicTypeMatch[0] : null
      }
    }
    return null
  } catch (error) {
    console.error('Error reading the file:', error)
    return null
  }
}

export { findMethodType }
