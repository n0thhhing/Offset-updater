import { classInfo } from "../structures/class_utils.js";
import * as nav from "./methodNavigation.js";
import { oldDump, newDump } from "../updaters/offset_updater.js";

function navigationUtils(filePath, offset) {
  let methodName = ""; // Initialize methodName

  const originalMethodName = oldDump.getMethodName(offset);
  console.log(oldDump.isObfuscated(originalMethodName), originalMethodName);

  for (let i = 0; !oldDump.isObfuscated(methodName) || methodName !== null || methodName !== "undefined" || oldDump.countOccurrences(methodName) ===1; i++) {
    const newOffset = nav.navigateMethods(filePath, offset, "up", i).offset;
    methodName = oldDump.getMethodName(newOffset);

    console.log(oldDump.isObfuscated(methodName), methodName);
  }
}

navigationUtils("./dump/old.cs", "0x5741AC0");
