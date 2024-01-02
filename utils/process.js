import fs from 'fs'
import file from 'fs/promises'
import { execSync } from 'child_process'

export const getMethodOffsets = async (
  filePath,
  filters = [],
  methodTypes = '.*',
) => {
  try {
    const buffer = await file.readFile(filePath, 'utf8')
    const filterRegex = Array.isArray(filters)
      ? filters.map(filter => `0x${filter}[0-9A-F]+`).join('|')
      : `0x${filters}[0-9A-F]+`
    const methodRegex = Array.isArray(methodTypes)
      ? methodTypes.join('|')
      : methodTypes
    const regex = new RegExp(
      `\/\/ RVA: (${filterRegex})[^]*?${methodRegex}\\s*(\\S+)`,
      'gs',
    )
    const matches = []

    let match
    while ((match = regex.exec(buffer)) !== null) {
      matches.push(match[1])
    }

    const offsets = await Promise.all(
      matches.map(async match => {
        return match
      }),
    )

    return { offsets: offsets.join(' '), count: offsets.length }
  } catch (error) {
    console.error('Error reading file:', error)
    return { offsets: '', count: 0 }
  }
}

/**
 * Find methods with return type bool and non-English method names.
 * @param {string} DUMP_PATH - Path to the dump file.
 * @returns {Array<{ offset: string, methodType: string, returnType: string, methodName: string }>} - Array of methods with offset, method type, return type, and method name.
 */
function getTypes(DUMP_PATH, Filter = '', method = '', SpecificType = '') {
  try {
    const dumpContent = fs.readFileSync(DUMP_PATH, 'utf-8')
    const regex =
      /\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x[0-9A-Fa-f]+ VA: 0x[0-9A-Fa-f]+\s+([a-zA-Z<>\s]+)\s+(.*?)\(/g

    let match
    let offsetsCombined = ''

    while ((match = regex.exec(dumpContent)) !== null) {
      const offset = `0x${match[1]}`
      const methodType = match[2].trim()
      let returnType = match[3].trim().split(/\s+/).slice(0, -1).join(' ')
      let methodName = match[3].trim()

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

        if (
          returnType === SpecificType &&
          offset.replace(/0x/g, '').startsWith(Filter) &&
          methodType.includes(method)
        ) {
          console.log(methodType)
          if (/[^\x00-\x7F]+/.test(methodName)) {
            // Do something if methodName contains non-ASCII characters
          }
          offsetsCombined += offset + '\n'
        }
      }
    }

    const count = offsetsCombined.split('\n').length - 1

    return { offsetsCombined, count }
  } catch (error) {
    console.error('Error reading the file:', error)
    return { offsetsCombined: '', count: 0 }
  }
}

export { getTypes }
