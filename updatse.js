import { readFile } from "fs/promises";
import fs, { createReadStream, promises as fsPromises } from "fs";
import readline from "readline";
import memoize from "fast-memoize";

const CHUNK_SIZE = 1024 * 1024;

const readBinaryFile = async (filePath) => {
  try {
    const fileStream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let binaryData = Buffer.from([]);
    for await (const line of rl) {
      binaryData = Buffer.concat([binaryData, Buffer.from(line, "hex")]);
    }

    return binaryData;
  } catch (error) {
    throw new Error(`Error reading file: ${error.message}`);
  }
};

const findClosestMatch = (hexPattern, binaryData) => {
  const patternBytes = hexToBytes(hexPattern);

  let closestMatch = null;
  let minDistance = Infinity;

  for (let i = 0; i < binaryData.length - patternBytes.length + 1; i++) {
    const distance = patternDistance(patternBytes, binaryData, i);

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = binaryData.slice(i, i + patternBytes.length);
    }
  }

  return closestMatch;
};

const findClosestMatchByOffset = (offsetHex, binaryData) => {
  const offsetBytes = hexToBytes(offsetHex);

  let closestMatch = null;
  let minDistance = Infinity;

  for (let i = 0; i < binaryData.length - offsetBytes.length + 1; i++) {
    const distance = patternDistance(offsetBytes, binaryData, i);

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = binaryData.slice(i, i + offsetBytes.length);
    }
  }

  return closestMatch;
};

const hexToBytes = (hex) => Buffer.from(hex.replace(/\s/g, ""), "hex");

const patternDistance = memoize((pattern, binaryData, index) => {
  let distance = 0;

  for (let i = 0; i < pattern.length; i++) {
    distance += Math.abs(pattern[i] - binaryData[index + i]);
  }

  return distance;
});

const getMemoryHex = async (offset, filePath) => {
  try {
    const fileBuffer = await readBinaryFile(filePath);
    const memorySlice = fileBuffer.slice(offset, offset + 100);
    return memorySlice.toString("hex");
  } catch (error) {
    throw new Error(`Error reading file: ${error.message}`);
  }
};

const getMemoryOffset = async (hex, filePath) => {
  try {
    const fileBuffer = await readBinaryFile(filePath);
    const hexPosition = fileBuffer.indexOf(hexToBytes(hex));

    if (hexPosition !== -1) {
      return `0x${hexPosition.toString(16).toUpperCase()}`;
    } else {
      return `Hex ${hex} not found in the file.`;
    }
  } catch (error) {
    throw new Error(`Error reading file: ${error.message}`);
  }
};

// ... (rest of your code)

const main = async () => {
  try {
    const filePath = "./libs/new.so";
    const hexPatterns = [
      "F5 53 BE A9 F3 7B 01 A9 95 C2 01 F0 A8 86 4A 39 F3 03 01 2A F4 03 00 AA 28 01 00 37 00 9A 01 D0 00 D8 43 F9 CE 70 36 97 00 9A 01 F0 00 84 47 F9 CB 70 36 97 28 00 80 52 A8 86 0A 39 E0 03 14 AA F6 FD FF 97 40 03 00 B4 08 38 40 F9 08 03 00 B4",
    ];
    const offsets = [0x491f3b4, 0x2bd4f20, 0x17c9190, 0x491f0ac, 0x491fea0];

    // Process hex patterns
    for (const hexPattern of hexPatterns) {
      console.log(`Searching for hex pattern: ${hexPattern}\n`);

      const binaryData = await readBinaryFile(filePath);

      const closestMatch = findClosestMatch(hexPattern, binaryData);

      if (closestMatch) {
        console.log(
          `Closest match for pattern (${hexPattern}):\n` +
          ` * Hex: ${closestMatch.toString("hex")}\n` +
          ` * Offset: ${await getMemoryOffset(
            closestMatch.toString("hex"),
            filePath
          )}\n\n`
        );
      } else {
        console.log(`No match found for pattern (${hexPattern})\n`);
      }
    }

    // Process offsets
    for (const offset of offsets) {
      const oldHex = await getMemoryHex(offset, "./libs/old.so");
      console.log(`Offsets corresponding hex (${offset}): ${oldHex}\n`);

      const binaryData = await readBinaryFile(filePath);

      const hexclosestMatch = findClosestMatchByOffset(oldHex, binaryData);

      if (hexclosestMatch) {
        console.log(
          `Closest match for offset (${offset}):\n` +
          ` * Hex: ${hexclosestMatch.toString("hex")}\n` +
          ` * Offset: ${await getMemoryOffset(
            hexclosestMatch.toString("hex"),
            filePath
          )}\n\n`
        );
      } else {
        console.log(`No match found for offset (${offset})\n`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
};

export { main };
main();
