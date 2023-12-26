import { classInfo } from "../structures/class_utils.js";
import * as nav from "./methodNavigation.js";
import { oldDump, newDump } from "../updaters/offset_updater.js";
console.trace()
function navigationUtils(filePath, offset) {
  offset = `0x${offset.toString(16).toUpperCase()}`;
  const originalMethodName = oldDump.getMethodName(offset);
  let methodName = originalMethodName;
  let i;
  for (i = 0; !oldDump.isObfuscated(methodName) && oldDump.countOccurrences(methodName) < 2; i++) {
    console.log(methodName)
    const newOffset = nav.originalMethodName(filePath, offset, "up", i).offset;
    methodName = oldDump.getMethodName(newOffset);
  }

  const oldInfo = { name: methodName, offset: oldDump.getOffsetByMethodName(methodName)}
  const newInfo = nav.navigateMethods("./dump/new.cs",newDump.getOffsetByMethodName(oldInfo.name), "down", i)
if (newInfo !== null) {
  return { offset: newInfo.offset, oldName: oldInfo.name, newName: newDump.getMethodName(newInfo.offset) };
} else {
  // Handle the case when offset is not found, e.g., return an error object
  return { error: "Offset not found in the C# file" };
}

  return { newInfo/*offset: newInfo.offset, oldName: oldInfo.name, newName: newDump.getMethodName(newInfo.offset)*/ }
}

//console.log(navigationUtils("./dump/old.cs", "0x5741AC0"));

for (let i = 0; i < 30; i++) {
  console.log(nav.navigateMethods("./dump/old.cs","0x5741AC0", "down", i))
}
