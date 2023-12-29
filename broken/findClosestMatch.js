/**
 * Finds the closest match within valid addresses in the new library.
 * @param {Buffer} segment - The segment to search within.
 * @param {Buffer} patternBytes - The pattern to search for.
 * @param {string} firstCharacter - The first character of the pattern.
 * @param {string} validAddresses - Valid addresses formatted as "0xoffset1 0xoffset2 ..."
 * @returns {Object} Object containing the closest match and iteration count.
 */
function findClosestMatch_broken(
  segment,
  patternBytes,
  firstCharacter,
  validAddresses,
) {
  const patternLength = patternBytes.length
  const lastOccurrence = getLastOccurrence(patternBytes)

  let closestMatch = null
  let minDistance = Infinity
  let iterationCount = 0

  // Early exit if pattern length is greater than segment length
  if (patternLength > segment.length) {
    return { closestMatch, iterationCount }
  }

  // Extract valid offsets from the string and convert them to an array
  const validOffsets = validAddresses
    .split(' ')
    .map(offset => parseInt(offset, 16))

  for (let i = 0; i < validOffsets.length; i++) {
    const offset = validOffsets[i]

    // Skip iterations if the offset is out of bounds
    if (offset < 0 || offset + patternLength > segment.length) {
      continue
    }

    iterationCount++

    const slice = segment.slice(offset, offset + patternLength)

    // Batch conversion of slice to hex for valid character set check
    const sliceHex = slice.toString('hex').toLowerCase()
    if (!isValidCharacterSet(sliceHex)) {
      continue
    }

    const firstNSame = slice
      .slice(0, N_INDEX)
      .equals(patternBytes.slice(0, N_INDEX))
    if (FIRST_N_SAME && !firstNSame) {
      continue
    }

    const distance = patternDistance(patternBytes.toString('hex'), sliceHex)
    if (distance < minDistance) {
      minDistance = distance
      closestMatch = slice
    }
  }

  return { closestMatch, iterationCount }
}
