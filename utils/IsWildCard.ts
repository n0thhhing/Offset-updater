const countCommas = (str: Operand): number =>
  str
    .split('')
    .reduce(
      (count: number, char: string): number => count + (char === ',' ? 1 : 0),
      0,
    );

const ADD = 6;
const BR = 23;

const instructions: InstructionCases = {
  wildCards: {
    ADRB: 9,
    BL: 21,
    B: 16,
    CBNZ: 26,
    CBZ: 27,
    CSEL: 51,
    FCMP: 80,
    LDP: 159,
    TBZ: 348,
    TBNZ: 346,
  },
  specialCards: {
    ldr: { LDRB: 161, LDR: 162 },
    str: { STRB: 325 },
  },
  safeCards: {
    STR: 326,
  },
};

const wildCardIds: Set<InstrId | { [key: string]: number }> = new Set(
  Object.values(instructions.wildCards),
);
const ldrCardIds: Set<InstrId> = new Set(
  Object.values(instructions.specialCards.ldr),
);
const strCardIds: Set<InstrId> = new Set(
  Object.values(instructions.specialCards.str),
);

export function instrIsWildCard(instr: Instruction): {
  isWildCard: boolean;
  specialByte: boolean;
} {
  let isWildCard: boolean = false;
  let specialByte: boolean = false;
  if (wildCardIds.has(instr.id)) {
    isWildCard = true;
    specialByte = false;
  } else if (
    ldrCardIds.has(instr.id) &&
    countCommas(instr.op_str) > 1 &&
    !/#\-0x[A-Fa-f0-9]+/g.test(instr.op_str)
  ) {
    isWildCard = true;
    specialByte = true;
  } else if (strCardIds.has(instr.id)) {
    if (
      !instr.op_str.includes('wzr') &&
      !instr.op_str.includes('w9' || 'w20')
    ) {
      isWildCard = true;
      specialByte = true;
    } else {
      isWildCard = false;
      specialByte = false;
    }
  } else if (instr.id === ADD) {
    if (!instr.op_str.includes('sp')) {
      isWildCard = true;
      specialByte = true;
    } else {
      isWildCard = false;
      specialByte = false;
    }
  } else {
    isWildCard = false;
    specialByte = false;
  }
  return { isWildCard, specialByte };
}
