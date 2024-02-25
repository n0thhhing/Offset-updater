const countCommas = (str: Operand) => (str.match(/,/g) || []).length;

interface WildCards {
  [key: string]: InstructionId | object;
}

const ADD = 6,
  BR = 23;
const specialCards: WildCards = {
  ldr: { LDRB: 161, LDR: 162 },
  str: {
    STRB: 325,
  },
};
const wildCards: WildCards = {
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
};
const safeCards = {
  STR: 326,
};

const wildCardIds = new Set(Object.values(wildCards));
const ldrCardIds = new Set(Object.values(specialCards.ldr));
const strCardIds = new Set(Object.values(specialCards.str));

export function instrIsWildCard(instr: Instruction): {
  isWildCard: boolean;
  specialByte: boolean;
} {
  let isWildCard = false;
  let specialByte = false;
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
