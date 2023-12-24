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
export function getMethodOffsets(csFilePath, offsetStartChar = null, methodType = null) {
  if (cachedOffsets.offsets !== null && cachedOffsets.count !== null) {
    return { offsets: cachedOffsets.offsets, count: cachedOffsets.count };
  }

  try {
    const csContent = fs.readFileSync(csFilePath, "utf-8");

    const methodTypePattern = methodType ? `${methodType}|` : '';
    const regex = new RegExp(
      `\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x([0-9A-Fa-f]+) VA: 0x[0-9A-Fa-f]+\\s+(${methodTypePattern}public|private|protected|internal|static|virtual|sealed|override|abstract|extern|async|unsafe).*\\(\\) \\{ \\}\\n`,
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
