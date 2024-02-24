import fs from 'fs';
export namespace PatternFinder {
  export function format(pattern: Pattern): Pattern {
    let result = '';
    const length = pattern.length;
    for (let i = 0; i < length; i++) {
      const ch = pattern[i];
      if (
        (ch >= '0' && ch <= '9') ||
        (ch >= 'A' && ch <= 'F') ||
        (ch >= 'a' && ch <= 'f') ||
        ch === '?'
      ) {
        result += ch;
      }
    }
    return result;
  }

  function hexChToInt(ch: string): number {
    if (ch >= '0' && ch <= '9') return parseInt(ch);
    if (ch >= 'A' && ch <= 'F')
      return ch.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
    if (ch >= 'a' && ch <= 'f')
      return ch.charCodeAt(0) - 'a'.charCodeAt(0) + 10;
    return -1;
  }

  export function hexStrToBuffer(hexString: string): Uint8Array {
    const buffer = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
      buffer[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return buffer;
  }

  export function Transform(pattern: Pattern): BytePattern[] {
    pattern = format(pattern);
    const length = pattern.length;
    if (length === 0) return [];
    const result: Byte[] = [];
    let newbyte: Byte = {
      N1: { Wildcard: false, Data: 0 },
      N2: { Wildcard: false, Data: 0 },
    };
    for (let i = 0, j = 0; i < length; i++) {
      const ch = pattern[i];
      if (ch === '?') {
        //wildcard
        if (j === 0) newbyte.N1.Wildcard = true;
        else newbyte.N2.Wildcard = true;
      } else {
        //hex
        const data = hexChToInt(ch);
        if (j === 0) {
          newbyte.N1.Wildcard = false;
          newbyte.N1.Data = data & 0xf;
        } else {
          newbyte.N2.Wildcard = false;
          newbyte.N2.Data = data & 0xf;
          result.push(newbyte);
          newbyte = {
            N1: { Wildcard: false, Data: 0 },
            N2: { Wildcard: false, Data: 0 },
          };
        }
      }
      j++;
      if (j === 2) j = 0;
    }
    return result;
  }

  function matchByte(b: number, p: Byte): boolean {
    if (!p.N1.Wildcard) {
      //if not a wildcard we need to compare the data.
      const n1 = b >> 4;
      if (n1 !== p.N1.Data)
        //if the data is not equal b doesn't match p.
        return false;
    }
    if (!p.N2.Wildcard) {
      //if not a wildcard we need to compare the data.
      const n2 = b & 0xf;
      if (n2 !== p.N2.Data)
        //if the data is not equal b doesn't match p.
        return false;
    }
    return true;
  }

  export function Find(
    data: Uint8Array,
    pattern: BytePattern[],
  ): { found: IsFound; offset: Offset };
  export function Find(
    data: Uint8Array,
    pattern: BytePattern[],
    offsetFound: { value: number },
    offset?: number,
  ): { found: IsFound; offset: Offset };
  export function Find(
    data: Uint8Array,
    pattern: BytePattern[],
    offsetFound?: { value: number },
    offset: number = 0,
  ): { found: IsFound; offset: Offset } {
    if (!offsetFound) offsetFound = { value: -1 };
    if (!data || !pattern) return { found: false, offset: null };
    const patternSize = pattern.length;
    if (data.length === 0 || patternSize === 0)
      return { found: false, offset: null };

    for (let i = offset, pos = 0; i < data.length; i++) {
      if (matchByte(data[i], pattern[pos])) {
        //check if the current data byte matches the current pattern byte
        pos++;
        if (pos === patternSize) {
          //everything matched
          offsetFound.value = i - patternSize + 1;
          return { found: true, offset: offsetFound.value };
        }
      } else {
        i -= pos;
        pos = 0; //reset current pattern position
      }
    }
    return { found: false, offset: null };
  }

  export function findAll(
    data: Uint8Array,
    pattern: Byte[],
    offsetsFound: number[],
  ): { found: IsFound; offsets: OffsetArr } {
    offsetsFound.length = 0;
    let size = data.length,
      pos = 0;
    while (size > pos) {
      let offsetFound;
      if (Find(data, pattern, { value: 0 }, pos)) {
        offsetFound = pos;
        offsetsFound.push(offsetFound);
        pos = offsetFound + pattern.length;
      } else break;
    }
    return { found: offsetsFound.length > 0, offsets: offsetsFound };
  }

  export function scan(data: Uint8Array, signatures: Signature[]): Signature[] {
    const found: Signature[] = [];
    signatures.forEach((signature) => {
      const offset = Find(data, signature.Pattern, { value: 0 });
      if (offset) found.push(signature);
    });
    return found;
  }
}
console.log(fs.readFileSync('libs/new.so'));
console.log(
  PatternFinder.Find(
    fs.readFileSync('libs/new.so'),
    PatternFinder.Transform('f5 53 be a9 f3 7b 01 a9 ?? ?? ?? ?? ??'),
  ),
);
