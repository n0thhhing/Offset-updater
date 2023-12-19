import fs from "fs";
import readline from "readline";

const fileCache = new Map();

async function check(offset, filePath) {
  try {
    let dump;

    // Check if the file content is already cached
    if (fileCache.has(filePath)) {
      dump = fileCache.get(filePath);
    } else {
      // If not, read the file content and cache it
      const readStream = fs.createReadStream(filePath, { encoding: "utf8" });
      const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

      dump = "";
      for await (const line of rl) {
        dump += line + "\n";
      }

      // Cache the file content
      fileCache.set(filePath, dump);
    }

    return dump.includes(offset.toString(16).toUpperCase());
  } catch (error) {
    console.error(chalk.red("Error validating offset:", error));
    return false;
  }
}

export { check };
