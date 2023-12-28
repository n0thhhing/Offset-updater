import { classInfo } from '../structures/class_utils.js'
import * as nav from './methodNavigation.js'
import { oldDump, newDump } from '../updaters/offset_updater.js'

function navigationUtils(offset) {
  let methodName = '' // Initialize methodName
  let i;
  let hasCompleted
  const originalMethodName = oldDump.getMethodName(offset)
  
  for (
    i = 0;
    !oldDump.isObfuscated(methodName) ||
    oldDump.countOccurrences(methodName) === 1 &&
    hasCompleted === 1;
    i++
  ) {
    const newOffset = oldDump.navigateMethods(offset, 'down', i).offset
    methodName = oldDump.getMethodName(newOffset)

    console.log({
      obfuscated: oldDump.isObfuscated(methodName),
      methodName: methodName,
      classNane: oldDump.getClassNameByOffset(newOffset),
      offset: newOffset,
      distance: i,
      methodCount: oldDump.countOccurrences(methodName)
    })
    if (!oldDump.isObfuscated(methodName) ||
    oldDump.countOccurrences(methodName) === 1) {
      hasCompleted = 1
    }
  }
}

//navigationUtils('0x22D99A0')
