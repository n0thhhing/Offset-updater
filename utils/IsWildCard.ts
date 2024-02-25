String.prototype.commas = function (): CommaCount {
  return this.split('').reduce(
    (count: CommaCount, char: string): CommaCount =>
      count + (char === ',' ? 1 : 0),
    0,
  );
};

const ADD: InstrId = 6,
  BR: InstrId = 23;

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
  specialCases: {
    ldr: { LDRB: 161, LDR: 162 },
    str: { STRB: 325 },
  },
  safeInstructions: {
    STR: 326,
  },
};

const wildCardIds: Set<InstrId | { [key: InstrKey]: InstrId }> = new Set(
  Object.values(instructions.wildCards),
);
const ldrCardIds: Set<InstrId> = new Set(
  Object.values(instructions.specialCases.ldr),
);
const strCardIds: Set<InstrId> = new Set(
  Object.values(instructions.specialCases.str),
);

export function instrIsWildCard(instr: Instruction): {
  isWildCard: boolean;
  specialByte: boolean;
} {
  const { op_str: operand, id }: { op_str: Operand; id: InstrId } = instr;
  let isWildCard: boolean = false;
  let specialByte: boolean = false;
  if (wildCardIds.has(id)) {
    isWildCard = true;
    specialByte = false;
  } else if (
    ldrCardIds.has(id) &&
    operand.commas() > 1 &&
    !/#\-0x[A-Fa-f0-9]+/g.test(operand)
  ) {
    isWildCard = true;
    specialByte = true;
  } else if (strCardIds.has(id)) {
    if (!operand.includes('wzr') && !operand.includes('w9' || 'w20')) {
      isWildCard = true;
      specialByte = true;
    } else {
      isWildCard = false;
      specialByte = false;
    }
  } else if (id === ADD) {
    if (!operand.includes('sp')) {
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
