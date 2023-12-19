// offsetUpdater.js

import fs from "fs";

function extractFieldDeclaration(filePath, oldOffset) {
  const oldFileContent = fs.readFileSync(filePath, "utf8");
  const regex = new RegExp(`\\b(\\w+\\s+\\w+\\s+\\w+).*\\b${oldOffset}\\b`);
  const match = oldFileContent.match(regex);

  if (match) {
    return match[1]; // Extracted field declaration
  }

  return null; // Field not found
}

function getNewOffset(newFilePath, fieldDeclaration) {
  const newFileContent = fs.readFileSync(newFilePath, "utf8");
  const regex = new RegExp(`(${fieldDeclaration}).*0x[0-9A-Fa-f]+`);
  const match = newFileContent.match(regex);

  if (match) {
    const newOffset = match[0].match(/0x[0-9A-Fa-f]+/);
    return newOffset ? newOffset[0] : null; // Extracted new offset
  }

  return null; // Field not found
}

// Example usage
const oldFilePath = "../dump/old.cs";
const oldOffset = "0x540";

const fieldDeclaration = extractFieldDeclaration(oldFilePath, oldOffset);

if (fieldDeclaration) {
  const newFilePath = "../dump/new.cs";
  const newOffset = getNewOffset(newFilePath, fieldDeclaration);

  if (newOffset) {
    console.log(`New offset for ${fieldDeclaration}: ${newOffset}`);
  } else {
    console.log(`Field ${fieldDeclaration} not found in the new file.`);
  }
} else {
  console.log(`Offset ${oldOffset} not found in the old file.`);
}
