import fs from "fs";

class classInfo {
  /**
   * @param {string} csPath - The path of the cs file
   */
  constructor(csPath) {
    this.path = csPath;
    this.content = fs.readFileSync(csPath, "utf-8");
    this.classRegex =
      /(?<classDeclaration>class\s+(\S+)\s+:\s+\S+(?:\s+\/\/.*)?)\n{1}(?<classBody>(?:.|\n)*?)\n}/gm;
    this.fieldRegex =
      /\s*(?<modifiers>(?:public|private|protected|internal|static|readonly)\s+)*?(?<type>\S+)\s+(?<name>\S+)\s*(?:=|;)/gm;
    this.methodRegex =
      /\/\/ RVA: (?<offset>0x[0-9A-F]{7,8}).*\n\s*(?<modifiers>(?:public|private|protected|internal|static|virtual|abstract|override|sealed|async|extern|partial|extern|unsafe|ref|out|params|async|await|new|.*)\s+)*?(?<returnType>\S+)\s+(?<name>\S+)\((?<params>.*)\)\s+\{(?<body>.*)\}/gm;
    this.obfuscation =
      /[\u4E00-\u9FFF\u3002\uFF1F\uFF01-\uFF0F\[\]\{\}\u3105-\u312F\u3000-\u303F\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\u00A0-\u05FF\u1F00-\u1FFF\u2600-\u26FF\u2700-\u27BF\!\"\#\ä\¸\“\$\%\^\&\*\+\-\=\~\`\"\'\.]/g;
  }

  /**
   * Checks a given string for obfuscation
   * @param {string} str - The string to check
   * @returns {boolean} - Whether the string is obfuscated
   */
  isObfuscated(str) {
    return this.obfuscation.test(str);
  }

  /**
   * Get method information by methodName
   * @param {string} methodName - The name of the method
   * @returns {object} - Information about the method
   */
  getMethodInfo(methodName) {
    try {
      const methodRegex = this.methodRegex;
      let methodMatch;
      let methodInfo;

      while ((methodMatch = methodRegex.exec(this.content))) {
        if (methodMatch.groups.name === methodName) {
          methodInfo = {
            offset: methodMatch.groups.offset
              .padStart(8, "0")
              .toUpperCase()
              .replace(/X/g, "x"),
            methodType: methodMatch.groups.modifiers,
            returnType: methodMatch.groups.returnType,
            methodName: methodMatch.groups.name,
            params: methodMatch.groups.params,
            fullMethod: methodMatch[0],
          };
          break;
        }
      }

      return methodInfo;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  /**
   * Get method info by offset
   * @param {string} offset - The offset value
   * @returns {object} - Information about the method
   */
  getOffsetInfo(offset) {
    const regex = this.methodRegex;
    const match = regex.exec(this.content, offset);

    if (match) {
      return {
        offset: match.groups.offset
          .padStart(8, "0")
          .toUpperCase()
          .replace(/X/g, "x"),
        methodType: match.groups.modifiers,
        returnType: match.groups.returnType,
        methodName: match.groups.name,
        params: match.groups.params,
        fullMethod: match[0],
      };
    } else {
      return null;
    }
  }

  /**
   * Get method by offset
   * @param {string} offset - The offset value
   * @returns {string|null} - The method with the specific offset
   */
  getMethod(offset) {
    const methodInfo = this.getInfo(offset);
    return methodInfo.fullMethod ? methodInfo.fullMethod : null;
  }

  /**
   * Get the class name that contains a method with the given offset
   * @param {string} offset - The offset value
   * @returns {string|null} - The name of the class containing the method, or null if not found
   */
  getClassFromOffset(offset) {
    try {
      const methodInfo = this.getOffsetInfo(offset);

      if (methodInfo) {
        // Find the class declaration that contains the method's offset
        const classRegex = new RegExp(this.classRegex);
        const classMatch = classRegex.exec(this.content, methodInfo.offset);

        if (classMatch) {
          return classMatch.groups.classDeclaration.split(" ")[1]; // Get the class name
        } else {
          console.warn(
            `Method offset ${offset} found, but class declaration not found`,
          );
          return null;
        }
      } else {
        console.warn(`Method not found for offset ${offset}`);
        return null;
      }
    } catch (error) {
      console.error("Error retrieving class from offset:", error);
      return null;
    }
  }

  /**
   * Get class information by className
   * @param {string} csPath - The path of the cs file
   * @param {string} className - The name of the class
   * @returns {object|null} - Information about the class
   */
  getClassInfo(csPath, className) {
    try {
      const fileContent = this.content;
      const classRegex = new RegExp(this.classRegex);

      const classMatch = classRegex.exec(fileContent);

      if (
        classMatch &&
        classMatch.groups.classDeclaration.includes(className)
      ) {
        const classBodyContent = classMatch.groups.classBody;

        const fieldRegex = this.fieldRegex;
        const methodRegex = this.methodRegex;

        const fields = [];
        const methods = [];

        let match;

        // Extract fields
        while ((match = fieldRegex.exec(classBodyContent)) !== null) {
          fields.push({
            modifiers: match.groups.modifiers,
            type: match.groups.type,
            name: match.groups.name,
          });
        }

        // Extract methods
        while ((match = methodRegex.exec(classBodyContent)) !== null) {
          methods.push({
            modifiers: match.groups.modifiers,
            offset: match.groups.offset,
            returnType: match.groups.returnType,
            name: match.groups.name,
            params: match.groups.params,
            body: match[0],
          });
        }

        return {
          fields,
          methods,
        };
      } else {
        throw new Error(`Class ${className} not found in ${csPath}`);
      }
    } catch (error) {
      console.error("Error parsing class info:", error);
      return null;
    }
  }
}

export { classInfo };