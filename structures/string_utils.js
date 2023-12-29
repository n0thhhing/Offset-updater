class string {
  compareStrings(strings) {
    if (!Array.isArray(strings) || strings.length < 2 || strings.length > 3) {
      throw new Error('Input must be an array of between 2 and 3 strings.')
    }

    const result = []
    const minLength = Math.min(...strings.map(str => str.length))

    for (let i = 0; i < minLength; i++) {
      const charAtIndex = strings.map(str => str[i])
      if (new Set(charAtIndex).size === 1) {
        result.push({ char: charAtIndex[0], index: i })
      }
    }

    return result
  }
}

export { string }
