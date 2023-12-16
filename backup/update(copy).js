import { readFile } from "fs/promises";
import fs from "fs";

async function readBinaryFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}
function findClosestMatch(hexPattern, binaryData) {
  const patternBytes = hexPattern.split(" ").map((byte) => parseInt(byte, 16));

  let closestMatch = null;
  let minDistance = Infinity;

  for (let i = 0; i < binaryData.length - patternBytes.length + 1; i++) {
    const segment = binaryData.slice(i, i + patternBytes.length);
    const distance = patternDistance(patternBytes, segment);

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = segment;
    }
  }

  return closestMatch;
}
function findClosestMatchByOffset(offsetHex, binaryData) {
  const offsetBytes = offsetHex
    .match(/.{1,2}/g)
    .map((byte) => parseInt(byte, 16));

  let closestMatch = null;
  let minDistance = Infinity;

  for (let i = 0; i < binaryData.length - offsetBytes.length + 1; i++) {
    const segment = binaryData.slice(i, i + offsetBytes.length);
    const distance = patternDistance(offsetBytes, segment);

    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = segment;
    }
  }

  return closestMatch;
}
function patternDistance(pattern, segment) {
  let distance = 0;

  for (let i = 0; i < pattern.length; i++) {
    distance += Math.abs(pattern[i] - segment[i]);
  }

  return distance;
}
const getMemoryHex = async (offset, filePath) => {
  try {
    const fileBuffer = await readFile(filePath);

    const memorySlice = fileBuffer.slice(offset, offset + 100);

    const memoryHex = memorySlice.toString("hex");

    return `${memoryHex}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
};
const getMemoryOffset = async (hex, filePath) => {
  try {
    const fileBuffer = await readFile(filePath);
    const hexPosition = fileBuffer.indexOf(Buffer.from(hex, "hex"));

    if (hexPosition !== -1) {
      return `0x${hexPosition.toString(16).toUpperCase()}`;
    } else {
      return `Hex ${hex} not found in the file.`;
    }
  } catch (error) {
    return `Error: ${error.message}`;
  }
};
async function main() {
  try {
    const filePath = "./libs/new.so";
    const hex =
      "F5 53 BE A9 F3 7B 01 A9 95 C2 01 F0 A8 86 4A 39 F3 03 01 2A F4 03 00 AA 28 01 00 37 00 9A 01 D0 00 D8 43 F9 CE 70 36 97 00 9A 01 F0 00 84 47 F9 CB 70 36 97 28 00 80 52 A8 86 0A 39 E0 03 14 AA F6 FD FF 97 40 03 00 B4 08 38 40 F9 08 03 00 B4";
    const offset = 0x491f3b4;
    const oldHex = await getMemoryHex(offset, "./libs/old.so");
    const offsetpat = oldHex;
    console.log("offsets corresponding hex:", oldHex + "\n");
    const binaryData = await readBinaryFile(filePath);
    const hexclosestMatch = await findClosestMatchByOffset(
      offsetpat,
      binaryData,
    );
    console.log(
      "closest match:\n" + " * Hex:",
      hexclosestMatch.toString("hex") + "\n" + " * offset:",
      await getMemoryOffset(hexclosestMatch.toString("hex"), filePath),
    );
  } catch (error) {
    console.error("Error:", error.message);
  }
}
// should output 0x45ED4A0
// https://github.com/n0thhhing/Offset-updater
export { main };
main();
