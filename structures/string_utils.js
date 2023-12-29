class string {
  compareStrings(strings) {
    if (!Array.isArray(strings) || strings.length < 2 || strings.length > 3) {
      throw new Error('Input must be an array of between 2 and 3 strings.')
    }

    const result = []
    const minLength = Math.min(...strings.map((str) => str.length))

    for (let i = 0; i < minLength; i++) {
      const charAtIndex = strings.map((str) => str[i])
      if (new Set(charAtIndex).size === 1) {
        result.push({ char: charAtIndex[0], index: i })
      }
    }

    return result
  }

  /**
   * Checks a given string for obfuscation
   * @param {string} str - The string to check
   * @returns {boolean} - Whether the string is obfuscated
   */
  isObfuscated(str) {
    this.obfuscation =
      /[\u4E00-\u9FFF\u4E00-\u9FFF三丒下丞世丑丝三丘\u3002\uFF1F\uFF01-\uFF0F\[\]\{\}\u3105-\u312F\u3000-\u303F\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\u1F00-\u1FFF\u2600-\u26FF\u2700-\u27BF\!\"\#\ä\¸\“\$\%\^\&\*\+\-\=\~\`\"\']/g
    return str !== null && str !== 'Method not found'
      ? this.obfuscation.test(str) && !/^[a-zA-Z]\w*$/.test(str)
      : null
  }
}

export { string }
