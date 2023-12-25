import fs from "fs";
//idfk
/**
 * Returns an array of offsets associated with methods in a given class from a C# file.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} className - The class name to search for.
 * @returns {Array<string>} An array of offsets associated with methods in the specified class.
 */
function getOffsetsFromClass(csFilePath, className) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    const lines = csContent.split("\n");

    let insideClass = false;
    let insideDesiredClass = false;
    let methodOffsets = [];

    for (const line of lines) {
      if (line.includes(`class ${className}`)) {
        insideClass = true;
        insideDesiredClass = true;
      } else if (insideClass && line.includes("{")) {
        insideDesiredClass = true;
      } else if (insideDesiredClass && line.includes("}")) {
        insideDesiredClass = false;
        insideClass = false;

        const match = line.match(/\/\/ RVA: (0x[0-9A-Fa-f]+)/);
        if (match && match[1]) {
          methodOffsets.push(match[1]);
        }
      } else if (insideDesiredClass) {
        const match = line.match(/\/\/ RVA: (0x[0-9A-Fa-f]+)/);
        if (match && match[1]) {
          methodOffsets.push(match[1]);
        }
      }
    }

    return methodOffsets;
  } catch (error) {
    console.error(
      `Error reading CS file(getOffsetsFromClass): ${error.message}`,
    );
    return [];
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
function navigateMethods(csFilePath, targetOffset, movement, count) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    const lines = csContent.split("\n");

    let currentClassName = "";
    let methodOffsets = [];

    for (const line of lines) {
      if (line.includes("class")) {
        const match = line.match(/class\s+(\S+)/);
        if (match && match[1]) {
          currentClassName = match[1];
        }
      }

      if (line.includes("// RVA:")) {
        const match = line.match(/\/\/ RVA: (0x[0-9A-Fa-f]+)/);
        if (match && match[1]) {
          methodOffsets.push({
            offset: match[1],
            className: currentClassName,
            signature: line.trim(),
          });
        }
      }
    }

    const index = methodOffsets.findIndex(
      ({ offset }) => offset === targetOffset,
    );

    if (index === -1) {
      console.error(
        `Offset ${targetOffset} not found in the C# file.(navigateMethods)`,
      );
      return null; // Offset not found
    }

    let newIndex;
    if (movement === "up") {
      newIndex = Math.max(0, index - count);
    } else if (movement === "down") {
      newIndex = Math.min(methodOffsets.length - 1, index + count);
    } else {
      console.error(`Invalid movement direction: ${movement}`);
      return null; // Invalid movement
    }

    const targetMethod = methodOffsets[newIndex];

    if (!targetMethod) {
      console.error(`Method not found for the given parameters.`);
      return null; // Method not found
    }

    const methodNameRegex = /\/\/ RVA: [^VA:]+ VA: [^ ]+ (.+)/;
    const methodNameMatch = targetMethod.signature.match(methodNameRegex);
    const methodName = methodNameMatch
      ? methodNameMatch[1]
      : "UnknownMethodName";

    const methodType = determineMethodType(targetMethod.signature);

    return {
      offset: targetMethod.offset,
      methodName: methodName.trim(),
      methodType: methodType,
      className: targetMethod.className,
    };
  } catch (error) {
    console.error(`Error reading CS file(navigateMethods): ${error.message}`);
    return null; // Error occurred
  }
}

/**
 * Determines the method type based on the provided method signature.
 *
 * @param {string} signature - The method signature.
 * @returns {string} The method type ("bool", "int", "string", etc.).
 */
function determineMethodType(signature) {
  if (signature.includes("bool")) {
    return "bool";
  } else if (signature.includes("int")) {
    return "int";
  } else if (signature.includes("string")) {
    return "string";
  } else if (signature.includes("float")) {
    return "float";
  } else if (signature.includes("double")) {
    return "double";
  } else if (signature.includes("object")) {
    return "object";
  } else if (signature.includes("byte")) {
    return "byte";
  } else if (signature.includes("short")) {
    return "short";
  } else if (signature.includes("long")) {
    return "long";
  } else if (signature.includes("char")) {
    return "char";
  } else if (signature.includes("decimal")) {
    return "decimal";
  } else {
    return "void";
  }
}

/**
 * Returns the index of the given offset within the method offsets array of the associated class.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} targetOffset - The offset to find within the class.
 * @returns {number} The index of the target offset in the class's method offsets array.
 */
function getIndexForOffset(csFilePath, targetOffset) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    // Split the content into lines
    const lines = csContent.split("\n");

    let insideClass = false;
    let insideDesiredClass = false;
    let currentClassName = "";
    let methodOffsets = [];

    // Iterate through lines
    for (const line of lines) {
      // Check if the line contains the class definition
      if (line.includes("class")) {
        const match = line.match(/class\s+(\S+)/);
        if (match && match[1]) {
          currentClassName = match[1];
        }
      }

      // Check if the line contains method offsets
      if (line.includes("// RVA:")) {
        const match = line.match(/\/\/ RVA: (0x[0-9A-Fa-f]+)/);
        if (match && match[1]) {
          methodOffsets.push({ offset: match[1], className: currentClassName });
        }
      }
    }

    // Find the class associated with the target offset
    const classWithOffset = methodOffsets.find(
      ({ offset }) => offset === targetOffset,
    );

    if (!classWithOffset) {
      console.error(
        `Offset ${targetOffset} not found in the C# file ${csFilePath}.(getIndexForOffset)`,
      );
      return -1; // Offset not found
    }

    // Get the method offsets for the associated class
    const offsetsForClass = getOffsetsFromClass(
      csFilePath,
      classWithOffset.className,
    );

    // Return the index of the target offset in the class's method offsets array
    const index = offsetsForClass.indexOf(targetOffset);

    if (index === -1) {
      console.error(
        `Offset ${targetOffset} not found in the class ${classWithOffset.className}.`,
      );
    }

    return index;
  } catch (error) {
    console.error(`Error reading CS file(getIndexForOffset): ${error.message}`);
    return -1; // Error occurred
  }
}

const NEW_DUMP_PATH = "./dump/new.cs";
const OLD_DUMP_PATH = "./dump/old.cs";
const offset = 0x59d9f38;
//console.log(getOffsetsFromClass(NEW_DUMP_PATH, getClassNameByOffset(OLD_DUMP_PATH, `0x${offset.toString(16).toUpperCase()}`))[getIndexForOffset(OLD_DUMP_PATH, `0x${offset.toString(16).toUpperCase()}`)])

function checkObfuscation(filePath, offset) {
  const fileContent = fs.readFileSync(filePath, "utf8");

  const methodNameRegex = new RegExp(
    `\\/\\/ RVA: ${offset} Offset: [^ ]+ VA: [^ ]+ \\S+ (\\S+)\\(`,
  );
  const methodNameMatch = fileContent.match(methodNameRegex);
  const methodName = methodNameMatch ? methodNameMatch[1] : "UnknownMethodName";

  const isObfuscated = methodName.match(/[\u4E00-\u9FFF]/) !== null; // Checks for Chinese characters in the method name

  return { isObfuscated, methodName };
}

/**
 * Gets the offset associated with the given method name in the provided C# file.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} methodName - The method name to search for.
 * @returns {string | null} The offset associated with the method name, or null if not found.
 */
function getOffsetByMethodName(csFilePath, methodName) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");
    const regex = new RegExp(
      `\/\/ RVA: (0x[0-9A-Fa-f]+) Offset: (0x[0-9A-Fa-f]+) VA: (0x[0-9A-Fa-f]+)\\s+${methodName}\\(`,
      "g",
    );

    const match = regex.exec(csContent);

    if (match && match[2]) {
      return match[2];
    }

    return null;
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
    return null;
  }
}

/**
 * Returns the class name associated with the given offset in a C# file.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} targetOffset - The offset for which to find the class name.
 * @returns {string | null} The class name associated with the offset, or null if not found.
 */
function getClassNameByOffset(csFilePath, targetOffset) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");
    const lines = csContent.split("\n");

    let currentClassName = null;

    for (const line of lines) {
      if (line.includes("class")) {
        const match = line.match(/class\s+(\S+)/);
        if (match && match[1]) {
          currentClassName = match[1];
        }
      }

      if (line.includes(`RVA: ${targetOffset}`)) {
        return currentClassName;
      }
    }

    console.error(
      `Offset ${targetOffset} not found in the C# file.(getClassNameByOffset)`,
    );
    return null; // Offset not found
  } catch (error) {
    console.error(
      `Error reading CS file(getClassNameByOffset): ${error.message}`,
    );
    return null; // Error occurred
  }
}

/**
 * Checks if a class name is obfuscated based on a set of criteria.
 *
 * @param {string} className - The class name to check for obfuscation.
 * @returns {boolean} True if the class name is considered obfuscated, false otherwise.
 */
function isClassNameObfuscated(className) {
  // Check if the class name contains non-ASCII characters
  const hasNonAsciiCharacters = /[^\x00-\x7F]/.test(className);

  return hasNonAsciiCharacters;
}

/**
 * Checks if a class name occurs more than once in a C# file.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} className - The class name to check for duplicity.
 * @returns {boolean} True if the class name occurs more than once, false otherwise.
 */
function isClassNameDuplicated(csFilePath, className) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    const lines = csContent.split("\n");

    let classCount = 0;

    // Iterate through lines
    for (const line of lines) {
      // Check if the line contains the class definition
      if (line.includes(`class ${className}`)) {
        classCount++;

        // If the class occurs more than once, return true
        if (classCount > 1) {
          return true;
        }
      }
    }

    // If the class occurs only once or not at all, return false
    return false;
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
    return false;
  }
}

export {
  getOffsetsFromClass,
  navigateMethods,
  determineMethodType,
  getIndexForOffset,
  checkObfuscation,
  getOffsetByMethodName,
  getClassNameByOffset,
  isClassNameDuplicated,
  isClassNameObfuscated,
};
