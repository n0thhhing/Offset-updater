import fs from "fs/promises";

async function findMethodType(DUMP_PATH, offset) {
  try {
    const dumpContent = await fs.readFile(DUMP_PATH, "utf-8");
    const regex =
      /\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x[0-9A-Fa-f]+ VA: 0x[0-9A-Fa-f]+\s+([a-zA-Z<>]+)\s+(.*?)\(/g;

    let match;
    while ((match = regex.exec(dumpContent)) !== null) {
      const currentOffset = parseInt(match[1], 16);
      const methodType = match[2].trim();
      const returnType = match[3].trim().split(/\s+/).slice(0, -1).join(" "); // Extracting all words except the last one

      if (currentOffset === offset) {
        return { methodType, returnType };
      }
    }

    // Return null if the offset is not found
    return null;
  } catch (error) {
    console.error("Error reading the file:", error);
    return null;
  }
}

async function findMethodTypeBasic(DUMP_PATH, offset) {
  try {
    const dumpContent = await fs.readFile(DUMP_PATH, "utf-8");

    const regex =
      /\/\/ RVA: 0x([0-9A-Fa-f]+) Offset: 0x[0-9A-Fa-f]+ VA: 0x[0-9A-Fa-f]+\s+(.*?)\(/g;

    let match;
    while ((match = regex.exec(dumpContent)) !== null) {
      const currentOffset = parseInt(match[1], 16);
      const methodType = match[2].trim();

      if (currentOffset === offset) {
        const basicTypeMatch = methodType.match(
          /\b(int|bool|float|void|long)\b/,
        );
        return basicTypeMatch ? basicTypeMatch[0] : null;
      }
    }
    return null;
  } catch (error) {
    console.error("Error reading the file:", error);
    return null;
  }
}

export { findMethodType };
