import fs from "fs";
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
export function getMethodOffsets(
  csFilePath,
  offsetStartChar = null,
  methodType = /public|private|protected|internal|static|virtual|sealed|override|abstract|extern|async|unsafe/,
) {
  if (cachedOffsets.offsets !== null && cachedOffsets.count !== null) {
    return { offsets: cachedOffsets.offsets, count: cachedOffsets.count };
  }

  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    const methodTypePattern = methodType ? `${methodType}|` : "";
    const regex = new RegExp(
      `\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x([0-9A-Fa-f]+) VA: 0x[0-9A-Fa-f]+\\s+(${methodTypePattern}).*\\(\\) \\{ \\}\\n`,
      "g",
    );

    const offsets = [];
    let match;

    while ((match = regex.exec(csContent)) !== null) {
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

    while ((match = regex.exec(dumpContent)) !== null) {
      const offset = `0x${match[1]}`;
      const methodType = match[2].trim();
      let returnType = match[3].trim().split(/\s+/).slice(0, -1).join(" ");
      let methodName = match[3].trim();

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

        if (
          returnType === SpecificType &&
          offset.replace(/0x/g, "").startsWith(Filter) &&
          methodType.includes(method)
        ) {
          console.log(methodType);
          if (/[^\x00-\x7F]+/.test(methodName)) {
          }
        }
      }
    }

    const count = offsetsString.length;

    return { offsetsCombined, count };
  } catch (error) {
    console.error("Error reading the file:", error);
    return { offsetsCombined: "", count: 0 };
  }
}

const soFilePath = "libs/new.so";
