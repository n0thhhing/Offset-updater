import fs from "fs";

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
    console.error(`Error reading CS file: ${error.message}`);
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


    const index = methodOffsets.findIndex(({ offset }) => offset === targetOffset);

    if (index === -1) {
      console.error(`Offset ${targetOffset} not found in the C# file.`);
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
    const methodName = methodNameMatch ? methodNameMatch[1] : "UnknownMethodName";


    const methodType = determineMethodType(targetMethod.signature);

    return {
      offset: targetMethod.offset,
      methodName: methodName.trim(),
      methodType: methodType,
      className: targetMethod.className,
    };
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
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
    const classWithOffset = methodOffsets.find(({ offset }) => offset === targetOffset);

    if (!classWithOffset) {
      console.error(`Offset ${targetOffset} not found in the C# file.`);
      return -1; // Offset not found
    }

    // Get the method offsets for the associated class
    const offsetsForClass = getOffsetsFromClass(csFilePath, classWithOffset.className);

    // Return the index of the target offset in the class's method offsets array
    const index = offsetsForClass.indexOf(targetOffset);

    if (index === -1) {
      console.error(
        `Offset ${targetOffset} not found in the class ${classWithOffset.className}.`,
      );
    }

    return index;
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
    return -1; // Error occurred
  }
}

/**
 * Checks if the method name associated with the given offset is obfuscated.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} offset - The offset to check.
 * @returns {Object} Object containing information about obfuscation.
 *   - {boolean} isObfuscated - Indicates if the method is obfuscated.
 *   - {string} methodName - The method name.
 *   - {number} obfuscationCount - The number of times the method name is obfuscated in the file.
 */
function checkObfuscation(csFilePath, offset) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");
    const regex = new RegExp(
      `\/\/ RVA: ${offset} Offset: ${offset} VA: ${offset}\\s+(.+?)\\(`,
      "g",
    );

    let match;
    let isObfuscated = false;
    let methodName = "";
    let obfuscationCount = 0;

    while ((match = regex.exec(csContent)) !== null) {
      obfuscationCount++;
      const currentMethodName = match[1];

      if (currentMethodName !== `get_${currentMethodName}`) {
        isObfuscated = true;
        methodName = currentMethodName;
      }
    }

    return { isObfuscated, methodName, obfuscationCount };
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
    return { isObfuscated: false, methodName: "", obfuscationCount: 0 };
  }
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

      if (line.includes(`// RVA: ${targetOffset}`)) {
        return currentClassName;
      }
    }

    console.error(`Offset ${targetOffset} not found in the C# file.`);
    return null; // Offset not found
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
    return null; // Error occurred
  }
}

/**
 * Checks if the provided class name appears obfuscated based on predefined patterns.
 *
 * @param {string} className - The class name to check for obfuscation.
 * @returns {boolean} True if the class name is considered obfuscated, false otherwise.
 */
function isObfuscatedClassName(className) {
  // Define patterns for obfuscated class names
  const obfuscatedPatterns = [
    /^[\u4E00-\u9FA5]+$/, // Chinese characters
    /^[a-z]{1,2}\d{4,}\.$/, // Lowercase letters followed by digits
    /^\p{Script=Hiragana}+$/, // Hiragana characters
    /^[\u3040-\u30FF]+$/, // Hiragana and Katakana characters
  ];

  return obfuscatedPatterns.some(pattern => pattern.test(className));
}

export {
  getOffsetsFromClass,
  navigateMethods,
  getIndexForOffset,
  checkObfuscation,
  getOffsetByMethodName,
  getClassNameByOffset
};
