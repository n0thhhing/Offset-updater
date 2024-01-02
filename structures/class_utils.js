const fs = await import('fs')
import file from 'fs/promises'
import chalk from 'chalk'
import { config } from '../updaters/offset_updater.js'

class classInfo {
  /**
   * @param {string} csPath - The path of the cs file
   */
  constructor(csPath) {
    this.path = csPath
    this.content = ''
    ;(async () => {
      try {
        const startTime = process.hrtime()

        const fileContentPromise = file.readFile(this.path, 'utf-8')
        this.content = await fileContentPromise
        const { logging = config.LOGGING } = config

        if (logging)
          console.log(
            chalk.grey(
              `this.content(${csPath}): ${(
                process.hrtime(startTime)[1] / 1e6
              ).toFixed(3)}ms`,
            ),
          )
      } catch (error) {
        console.error('Error reading file:', error)
      }
    })()
    this.classRegex =
      /(?<classDeclaration>class\s+(\S+)\s+:\s+\S+(?:\s+\/\/.*)?)\n{1}(?<classBody>(?:.|\n)*?)\n}/gm
    this.fieldRegex =
      /\s*(?<modifiers>(?:public|private|protected|internal|static|readonly)\s+)*?(?<type>\S+)\s+(?<name>\S+)\s*(?:=|;)/gm
    this.methodRegex =
      /\/\/ RVA: (?<offset>0x[0-9A-F]{7,8}).*\n\s*(?<modifiers>(?:public|private|protected|internal|static|virtual|abstract|override|sealed|async|extern|partial|extern|unsafe|ref|out|params|async|await|new|.*)\s+)*?(?<returnType>\S+)\s+(?<name>\S+)\((?<params>.*)\)\s+\{(?<body>.*)\}/gm
    this.obfuscation =
      /[\u4E00-\u9FFF\u4E00-\u9FFF三丒下丞世丑丝三丘\u3002\uFF1F\uFF01-\uFF0F\[\]\{\}\u3105-\u312F\u3000-\u303F\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\u1F00-\u1FFF\u2600-\u26FF\u2700-\u27BF\!\"\#\ä\¸\“\$\%\^\&\*\+\-\=\~\`\"\']/g
  }

  async getMethodOffsets(filePath, filters = [], methodTypes = '.*') {
    try {
      const buffer = this.content
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

  async findMethodTypeBasic(offset) {
    try {
      const dumpContent = this.content
      const test = new RegExp(
        `// RVA: (${offset}).*\n.* ([void|bool|byte|char|decimal|double|float|int|long|object|string]+)`,
      )

      const match = test.exec(this.content)
      if (match != (undefined || null)) {
        const returnType = match === (undefined || null) ? null : match[2]
        return returnType
      } else {
        console.error('what')
        return null
      }
    } catch (error) {
      console.error('Error reading the file:', error)
      return null
    }
  }

  findMethodType(offset) {
    try {
      const dumpContent = this.content
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

  /**
   * Checks if an offset is in a cs file path
   * @param{number | string} offset - The offset to check for
   */
  async check(offset, filePath) {
    try {
      let dump = this.content
      return dump.includes(offset.toString(16).toUpperCase())
    } catch (error) {
      console.error(chalk.red('Error validating offset:', error))
      return false
    }
  }

  /**
   * Returns the method information after navigating through the class methods based on the given offset,
   * movement, and count.
   *
   * @param {string} csFilePath - The path to the C# file.
   * @param {string} targetOffset - The offset to start navigation.
   * @param {string} movement - The movement direction ("up" or "down").
   * @param {number} count - The number of methods to navigate.
   * @returns {Object} The method information object { offset, methodName, methodType, className }.
   */
  navigateMethods(targetOffset, movement, count) {
    try {
      const csContent = this.content
      const lines = csContent.split('\n')

      let currentClassName = ''
      let methodOffsets = []
      let offsetMap = {} // Map for faster offset lookups

      for (const line of lines) {
        if (line.startsWith('class ')) {
          currentClassName = line.split(' ')[1].trim()
        } else if (line.includes('// RVA:')) {
          const offsetMatch = /\/\/ RVA: (0x[0-9A-Fa-f]+)/.exec(line)
          if (offsetMatch) {
            const offset = offsetMatch[1]
            methodOffsets.push({
              offset,
              className: currentClassName,
              signature: line.trim(),
            })
            offsetMap[offset] = methodOffsets.length - 1 // Map offset to index
          }
        }
      }

      const index = offsetMap[targetOffset]

      if (index === undefined) {
        console.error(
          `Offset ${targetOffset} not found in the C# file. (navigateMethods)`,
        )
        return null // Offset not found
      }

      let newIndex

      if (movement === 'up') {
        newIndex = Math.max(0, index - count)
      } else if (movement === 'down') {
        newIndex = Math.min(methodOffsets.length - 1, index + count)
      } else {
        console.error(`Invalid movement direction: ${movement}`)
        return null // Invalid movement
      }

      const targetMethod = methodOffsets[newIndex]

      if (!targetMethod) {
        console.error(`Method not found for the given parameters.`)
        return null // Method not found
      }

      const methodNameRegex = /\/\/ RVA: .+ (.+)/
      const methodNameMatch = targetMethod.signature.match(methodNameRegex)
      const methodName = methodNameMatch
        ? methodNameMatch[1]
        : 'UnknownMethodName'

      const methodType = this.determineMethodType(targetMethod.signature)

      return {
        offset: targetMethod.offset,
        methodName: this.getMethodName(targetMethod.offset),
        returnType: this.getOffsetInfo(targetMethod.offset).returnType,
        className: targetMethod.className,
      }
    } catch (error) {
      console.error(`Error reading CS file (navigateMethods): ${error.stack}`)
      return null // Error occurred
    }
  }

  /**
   * Determines the method type based on the provided method signature.
   *
   * @param {string} signature - The method signature.
   * @returns {string} The method type ("bool", "int", "string", etc.).
   */
  determineMethodType(signature) {
    if (signature.includes('bool')) {
      return 'bool'
    } else if (signature.includes('int')) {
      return 'int'
    } else if (signature.includes('string')) {
      return 'string'
    } else if (signature.includes('float')) {
      return 'float'
    } else if (signature.includes('double')) {
      return 'double'
    } else if (signature.includes('object')) {
      return 'object'
    } else if (signature.includes('byte')) {
      return 'byte'
    } else if (signature.includes('short')) {
      return 'short'
    } else if (signature.includes('long')) {
      return 'long'
    } else if (signature.includes('char')) {
      return 'char'
    } else if (signature.includes('decimal')) {
      return 'decimal'
    } else {
      return 'void'
    }
  }

  getOffsetByMethodName(methodName) {
    try {
      const csContent = this.content
      const regex = new RegExp(
        `\/\/ RVA: (0x[0-9A-Fa-f]+) Offset: (0x[0-9A-Fa-f]+) VA: (0x[0-9A-Fa-f]+).*\\s+.*${methodName}\\(`,
        'g',
      )

      const match = regex.exec(csContent)

      if (match && match[2]) {
        return match[2]
      }

      return null
    } catch (error) {
      console.error(`Error reading CS file: ${error.message}`)
      return null
    }
  }

  countOccurrences(searchString) {
    const regex = new RegExp(searchString, 'g')
    const matches = this.content.match(regex)

    return matches ? matches.length : 0
  }

  findOccurrenceIndex(searchString) {
    const regex = new RegExp(searchString, 'g')
    const matches = this.content.match(regex)

    if (matches && matches.length > 1) {
      return (
        this.content.indexOf(
          searchString,
          this.content.indexOf(searchString) + 1,
        ) + 1
      )
    } else if (matches && matches.length === 1) {
      return (
        this.content.indexOf(
          searchString,
          this.content.indexOf(searchString) + 1,
        ) + 1
      )
    }

    return -1
  }

  findMethodOffsetByIndex(index, methodName) {
    const methodRegex =
      /\/\/ RVA: (?<offset>0x[0-9A-F]{7,8}).*\n\s*(?<modifiers>(?:public|private|protected|internal|static|virtual|abstract|override|sealed|async|extern|partial|extern|unsafe|ref|out|params|async|await|new|.*)\s+)*?(?<returnType>\S+)\s+(?<name>\S+)\((?<params>.*)\)\s+\{(?<body>.*)\}/gm

    methodRegex.lastIndex = 0

    let match
    let currentIndex = 0
    while ((match = methodRegex.exec(this.content)) !== null) {
      currentIndex++

      if (currentIndex === index && match.groups.name === methodName) {
        return match.groups.offset
      }
    }

    return null
  }

  getMethodName(offset) {
    const regex = this.methodRegex
    // Reset the regex to ensure it starts from the beginning
    regex.lastIndex = 0

    let match
    while ((match = regex.exec(this.content)) !== null) {
      const matchOffset = match.groups.offset

      if (matchOffset === offset) {
        const methodName = match.groups.name
        return methodName
      }
    }

    return 'Method not found'
  }

  /**
   * Get method information by methodName
   * @param {string} methodName - The name of the method
   * @returns {object} - Information about the method
   */
  getMethodInfo(methodName) {
    try {
      const methodRegex = this.methodRegex
      let methodMatch
      let methodInfo

      while ((methodMatch = methodRegex.exec(this.content))) {
        if (methodMatch.groups.name === methodName) {
          methodInfo = {
            offset: methodMatch.groups.offset
              .padStart(8, '0')
              .toUpperCase()
              .replace(/X/g, 'x'),
            methodType: methodMatch.groups.modifiers,
            returnType: methodMatch.groups.returnType,
            methodName: methodMatch.groups.name,
            params: methodMatch.groups.params,
            fullMethod: methodMatch[0],
          }
          break
        }
      }

      return methodInfo
    } catch (error) {
      console.log(error)
      return null
    }
  }

  /**
   * Get method info by offset
   * @param {string} offset - The offset value
   * @returns {object} - Information about the method
   */
  getOffsetInfo(offset) {
    const regex = this.methodRegex
    const match = regex.exec(this.content, offset)

    if (match) {
      return {
        offset: match.groups.offset
          .padStart(8, '0')
          .toUpperCase()
          .replace(/X/g, 'x'),
        methodType: match.groups.modifiers,
        returnType: match.groups.returnType,
        methodName: match.groups.name,
        params: match.groups.params,
        fullMethod: match[0],
      }
    } else {
      return null
    }
  }

  /**
   * Get method by offset
   * @param {string} offset - The offset value
   * @returns {string|null} - The method with the specific offset
   */
  getMethod(offset) {
    const methodInfo = this.getInfo(offset)
    return methodInfo.fullMethod ? methodInfo.fullMethod : null
  }

  /**
   * Returns the class name associated with the given offset in a C# file.
   *
   * @param {string} targetOffset - The offset for which to find the class name.
   * @returns {string | null} The class name associated with the offset, or null if not found.
   */
  getClassNameByOffset(targetOffset) {
    try {
      const csContent = this.content
      const lines = csContent.split('\n')

      let currentClassName = null

      for (const line of lines) {
        if (line.includes('class')) {
          const match = line.match(/class\s+(\S+)/)
          if (match && match[1]) {
            currentClassName = match[1]
          }
        }

        if (line.includes(`RVA: ${targetOffset}`)) {
          return currentClassName
        }
      }

      console.error(
        `Offset ${targetOffset} not found in the C# file.(getClassNameByOffset)`,
      )
      return null // Offset not found
    } catch (error) {
      console.error(
        `Error reading CS file(getClassNameByOffset): ${error.message}`,
      )
      return null // Error occurred
    }
  }

  /**
   * Get class information by className
   * @param {string} csPath - The path of the cs file
   * @param {string} className - The name of the class
   * @returns {object|null} - Information about the class
   */
  getClassInfo(csPath, className) {
    try {
      const fileContent = this.content
      const classRegex = new RegExp(this.classRegex)

      const classMatch = classRegex.exec(fileContent)

      if (
        classMatch &&
        classMatch.groups.classDeclaration.includes(className)
      ) {
        const classBodyContent = classMatch.groups.classBody

        const fieldRegex = this.fieldRegex
        const methodRegex = this.methodRegex

        const fields = []
        const methods = []

        let match

        // Extract fields
        while ((match = fieldRegex.exec(classBodyContent)) !== null) {
          fields.push({
            modifiers: match.groups.modifiers,
            type: match.groups.type,
            name: match.groups.name,
          })
        }

        // Extract methods
        while ((match = methodRegex.exec(classBodyContent)) !== null) {
          methods.push({
            modifiers: match.groups.modifiers,
            offset: match.groups.offset,
            returnType: match.groups.returnType,
            name: match.groups.name,
            params: match.groups.params,
            body: match[0],
          })
        }

        return {
          fields,
          methods,
        }
      } else {
        throw new Error(`Class ${className} not found in ${csPath}`)
      }
    } catch (error) {
      console.error('Error parsing class info:', error)
      return null
    }
  }

  content() {
    return this.content
  }
}

export { classInfo }
