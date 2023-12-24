import fs from "fs";

/**
 * Returns an array of offsets associated with methods in a given class from a C# file.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} className - The class name to search for.
 * @returns {Array<string>} An array of offsets associated with methods in the specified class.
 */
export function getOffsetsFromClass(csFilePath, className) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    // Split the content into lines
    const lines = csContent.split('\n');

    // Define variables to track class state
    let insideClass = false;
    let insideDesiredClass = false;
    let methodOffsets = [];

    // Iterate through lines
    for (const line of lines) {
      // Check if the line contains the class definition
      if (line.includes(`class ${className}`)) {
        insideClass = true;
        insideDesiredClass = true;
      } else if (insideClass && line.includes('{')) {
        // Check if we're inside the desired class
        insideDesiredClass = true;
      } else if (insideDesiredClass && line.includes('}')) {
        // Exit the class when encountering the closing bracket
        insideDesiredClass = false;
        insideClass = false;
      } else if (insideDesiredClass && line.includes('// RVA:')) {
        // Extract method offsets within the desired class
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

// Example usage:
const csFilePath = "./dump/new.cs";
const classNameToFind = "CapturePointsModeController";
const offsets = getOffsetsFromClass(csFilePath, classNameToFind);

console.log(offsets);


/**
 * Returns the index of the given offset within the method offsets array of the associated class.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} targetOffset - The offset to find within the class.
 * @returns {number} The index of the target offset in the class's method offsets array.
 */
export function getIndexForOffset(csFilePath, targetOffset) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    // Split the content into lines
    const lines = csContent.split('\n');

    // Define variables to track class state
    let insideClass = false;
    let insideDesiredClass = false;
    let currentClassName = "";
    let methodOffsets = [];

    // Iterate through lines
    for (const line of lines) {
      // Check if the line contains the class definition
      if (line.includes('class')) {
        const match = line.match(/class\s+(\S+)/);
        if (match && match[1]) {
          currentClassName = match[1];
        }
      }

      // Check if the line contains method offsets
      if (line.includes('// RVA:')) {
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
      console.error(`Offset ${targetOffset} not found in the class ${classWithOffset.className}.`);
    }

    return index;
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
    return -1; // Error occurred
  }
}

// Example usage:
//const csFilePath = "./dump/new.cs";
const targetOffset = '0x3331E00';
const index = getIndexForOffset(csFilePath, targetOffset);

console.log(index);

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
export function checkObfuscation(csFilePath, offset) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");
    const regex = new RegExp(`\/\/ RVA: ${offset} Offset: ${offset} VA: ${offset}\\s+(.+?)\\(`, "g");

    let match;
    let isObfuscated = false;
    let methodName = "";
    let obfuscationCount = 0;

    while ((match = regex.exec(csContent)) !== null) {
      obfuscationCount++;
      const currentMethodName = match[1];

      // Check if the method name is obfuscated
      if (currentMethodName !== `get_${currentMethodName}`) {
        isObfuscated = true;
        methodName = currentMethodName;
        break;  // If obfuscated method found, exit the loop
      }
    }

    return { isObfuscated, methodName, obfuscationCount };
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
    return { isObfuscated: false, methodName: "", obfuscationCount: 0 };
  }
}

// Example usage:
//const csFilePath = "./dump/new.cs";
const offsetToCheck = "0x45ED198";
const result = checkObfuscation(csFilePath, offsetToCheck);

console.log(result);



//works

/**
 * Gets the offset associated with the given method name in the provided C# file.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string} methodName - The method name to search for.
 * @returns {string | null} The offset associated with the method name, or null if not found.
 */
export function getOffsetByMethodName(csFilePath, methodName) {
  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");
    const regex = new RegExp(`\/\/ RVA: (0x[0-9A-Fa-f]+) Offset: (0x[0-9A-Fa-f]+) VA: (0x[0-9A-Fa-f]+)\\s+${methodName}\\(`, "g");

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

// Example usage:
//const csFilePath = "./dump/new.cs";
const methodNameToFind = "internal int get_Energy";
const offsetResult = getOffsetByMethodName(csFilePath, methodNameToFind);

console.log(offsetResult);

//////
/**
 * Cached offsets from the CS file.
 * @type {{ offsets: string | null, count: number | null }}
 */
let cachedOffsets = { offsets: null, count: null };

/**
 * Retrieves method offsets from a C# file based on a specified offset start character and method type.
 *
 * @param {string} csFilePath - The path to the C# file.
 * @param {string | null} offsetStartChar - Optional. The character that the offset should start with.
 * @param {string | null} methodType - Optional. The method type to filter (e.g., public, private, internal).
 * @returns {{ offsets: string, count: number }} - Object containing offsets as a string and count of offsets.
 */
export function getMethodOffsets(csFilePath, offsetStartChar = null, methodType = /public|private|protected|internal|static|virtual|sealed|override|abstract|extern|async|unsafe/) {
  if (cachedOffsets.offsets !== null && cachedOffsets.count !== null) {
    return { offsets: cachedOffsets.offsets, count: cachedOffsets.count };
  }

  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    const methodTypePattern = methodType ? `${methodType}|` : '';
    const regex = new RegExp(
      `\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x([0-9A-Fa-f]+) VA: 0x[0-9A-Fa-f]+\\s+(${methodTypePattern}).*\\(\\) \\{ \\}\\n`,
      "g"
    );

    const offsets = [];
    let match;

    while ((match = regex.exec(csContent)) !== null) {
      const offset = match[2]; // Use the second capturing group directly
      if (!offsetStartChar || offset.startsWith(offsetStartChar)) {
        offsets.push(`0x${offset}`);
      }
    }

    cachedOffsets.offsets = offsets.join(" ");
    cachedOffsets.count = offsets.length;

    return { offsets: cachedOffsets.offsets, count: cachedOffsets.count };
  } catch (error) {
    console.error(`Error reading CS file: ${error.message}`);
    return { offsets: "", count: 0 };
  }
}


/**
 * Find methods with return type bool and non-English method names.
 * @param {string} DUMP_PATH - Path to the dump file.
 * @returns {Array<{ offset: string, methodType: string, returnType: string, methodName: string }>} - Array of methods with offset, method type, return type, and method name.
 */
function getTypes(DUMP_PATH, Filter = "", method = "", SpecificType = "") {
  try {
    const dumpContent = fs.readFileSync(DUMP_PATH, "utf-8");
    const regex =
      /\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x[0-9A-Fa-f]+ VA: 0x[0-9A-Fa-f]+\s+([a-zA-Z<>\s]+)\s+(.*?)\(/g;

    let match;
    const offsetsString = []; // New array to store offsets as strings

    while ((match = regex.exec(dumpContent)) !== null) {
      const offset = `0x${match[1]}`;
      const methodType = match[2].trim();
      let returnType = match[3].trim().split(/\s+/).slice(0, -1).join(" ");
      let methodName = match[3].trim();

      // Check for two-word return types
      if (returnType.startsWith("<") && returnType.endsWith(">")) {
        const secondWordIndex = returnType.indexOf(
          " ",
          returnType.indexOf(">") + 1,
        );
        returnType = returnType.substring(
          returnType.indexOf("<") + 1,
          secondWordIndex !== -1 ? secondWordIndex : undefined,
        );
      }

      // Slice off everything after common types (void, bool, byte, etc.)
      const commonTypes = [
        "void",
        "bool",
        "byte",
        "char",
        "decimal",
        "double",
        "float",
        "int",
        "long",
        "object",
        "string",
      ];
      const commonTypeIndex = commonTypes.findIndex((type) =>
        returnType.startsWith(type),
      );

      if (commonTypeIndex !== -1) {
        returnType = commonTypes[commonTypeIndex];

        // Check if the method type is "bool"
        if (returnType === SpecificType && offset.replace(/0x/g, "").startsWith(Filter) && methodType.includes(method)) {
          // Check if the method name contains non-English characters
          console.log(methodType)
          if (/[^\x00-\x7F]+/.test(methodName)) {
            offsetsString.push(offset); // Add the offset to the new array
          }
        }
      }
    }

    const count = offsetsString.length
    const offsetsCombined = offsetsString.join(" "); // Combine offsets into a string
    return { offsetsCombined, count } ;
  } catch (error) {
    console.error("Error reading the file:", error);
    return { offsetsCombined: "", count: 0 };
  }
}


// Example usage
//const csFilePath = "dump/new.cs";
const soFilePath = "libs/new.so";

// Get method offsets from CS file
//const methodOffsets = getTypes(csFilePath, "2", "internal static", "int")//getMethodOffsets(csFilePath, "4", "internal static int");
//console.log(methodOffsets)