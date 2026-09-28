import type { Instruction } from '../disassembler';

/**
 * AArch64 Nibble-level Wildcard Mask Generator
 *
 * Instead of a coarse "wildcard whole instruction / keep byte[3]" heuristic,
 * this module computes a per-nibble mask string for each instruction.
 *
 * Mask format: 8 hex chars (one per nibble of the 4-byte instruction),
 * where '?' = wildcard this nibble and the literal hex char = keep it.
 *
 * Example outputs:
 *   BL  #addr   →  "??????9?"   (opcode high-nibble '9' preserved)
 *   B   #addr   →  "??????1?"   (opcode high-nibble '1' preserved)
 *   B.EQ #addr  →  "?0????54"   (condition nibble '0' + full opcode byte '54' preserved)
 *   CBZ X0, #a  →  "??????b4"   (opcode+size byte 'b4' preserved)
 *   TBZ X0, #5  →  "????b6??"   (bit-position byte preserved via partial mask)
 *   ADRP X0, p  →  "????????"   (fully volatile — immhi+immlo span almost all bits)
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/**
 * [highBit, lowBit] inclusive, with bit 31 = MSB of the 32-bit AArch64 word.
 * AArch64 words are stored little-endian: byte[0]=bits[7:0], byte[3]=bits[31:24].
 */
type BitRange = readonly [number, number];

/**
 * Maps nibble index (0 = b0_high … 7 = b3_low) to the bit-range it covers
 * in the 32-bit instruction word.
 */
const NIBBLE_BIT_RANGES: readonly BitRange[] = [
  [7, 4], // nibble 0 → byte 0 high
  [3, 0], // nibble 1 → byte 0 low
  [15, 12], // nibble 2 → byte 1 high
  [11, 8], // nibble 3 → byte 1 low
  [23, 20], // nibble 4 → byte 2 high
  [19, 16], // nibble 5 → byte 2 low
  [31, 28], // nibble 6 → byte 3 high
  [27, 24], // nibble 7 → byte 3 low
];

const HEX_CHARS = '0123456789abcdef';
const HEX_TABLE = new Array<string>(256);
for (let i = 0; i < 256; i++) {
  HEX_TABLE[i] = (i < 16 ? '0' : '') + i.toString(16);
}

function computeNibbleWildcardMask(volatile: readonly BitRange[]): number {
  let mask = 0;
  for (let i = 0; i < NIBBLE_BIT_RANGES.length; i++) {
    const [nibHi, nibLo] = NIBBLE_BIT_RANGES[i];
    const isVolatile = volatile.some(([volHi, volLo]) => nibHi >= volLo && nibLo <= volHi);
    if (isVolatile) mask |= 1 << i;
  }
  return mask;
}

/**
 * Given instruction bytes (little-endian AArch64) and an 8-bit nibble mask,
 * returns an 8-char nibble mask string.
 */
function formatMaskedNibbles(bytes: number[], mask: number): string {
  const b0 = bytes[0],
    b1 = bytes[1],
    b2 = bytes[2],
    b3 = bytes[3];
  return (
    (mask & 1 ? '?' : HEX_CHARS[b0 >> 4]) +
    (mask & 2 ? '?' : HEX_CHARS[b0 & 0xf]) +
    (mask & 4 ? '?' : HEX_CHARS[b1 >> 4]) +
    (mask & 8 ? '?' : HEX_CHARS[b1 & 0xf]) +
    (mask & 16 ? '?' : HEX_CHARS[b2 >> 4]) +
    (mask & 32 ? '?' : HEX_CHARS[b2 & 0xf]) +
    (mask & 64 ? '?' : HEX_CHARS[b3 >> 4]) +
    (mask & 128 ? '?' : HEX_CHARS[b3 & 0xf])
  );
}

function formatLiteralBytes(bytes: number[]): string {
  if (bytes.length === 4) {
    return HEX_TABLE[bytes[0]] + HEX_TABLE[bytes[1]] + HEX_TABLE[bytes[2]] + HEX_TABLE[bytes[3]];
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += HEX_TABLE[bytes[i]];
  }
  return s;
}

// ---------------------------------------------------------------------------
// Operand heuristics
// ---------------------------------------------------------------------------

/**
 * Returns true if the operand contains a hex immediate that looks like a
 * non-trivial offset (>= 0x100).  Small immediates are treated as stable
 * struct-field or stack offsets and are left literal.
 */
function hasLargeHexImmediate(operand: string): boolean {
  const m = operand.match(/#(0x[0-9a-f]+)/i);
  return m !== null && parseInt(m[1], 16) >= 0x100;
}

/**
 * Returns true if the operand uses a negative offset (e.g. [x29, #-0x10]).
 * Negative offsets are frame-pointer-relative locals — typically stable.
 */
function hasNegativeOffset(operand: string): boolean {
  return /#-0x[0-9a-f]+/i.test(operand);
}

/**
 * Returns true for LDR/STR operands in the [Xn, #imm] form
 * (positive offset, not post-index form like [Xn], #imm).
 */
function isRegisterOffset(operand: string): boolean {
  return operand.includes('[') && operand.includes(',') && !hasNegativeOffset(operand);
}

// ---------------------------------------------------------------------------
// Wildcard rule table
// ---------------------------------------------------------------------------

interface WildcardRule {
  /** Return true if this rule applies to the instruction. */
  match: (mnemonic: string, operand: string) => boolean;
  /** Volatile bit ranges for the 32-bit AArch64 word. */
  volatile: readonly BitRange[];
}

const RAW_RULES: WildcardRule[] = [
  // ─── Unconditional branches ──────────────────────────────────────────────
  // B / BL: bits[31:26] = opcode, bits[25:0] = imm26 (volatile).
  // Nibble 6 (bits[31:28]) is stable: '1' for B, '9' for BL.
  // Nibble 7 (bits[27:24]) is partially volatile (imm26[25:24] in bits[25:24]).
  {
    match: (m) => m === 'b' || m === 'bl',
    volatile: [[25, 0]],
  },

  // ─── PC-relative addressing ──────────────────────────────────────────────
  // ADRP: immhi[18:0]=bits[23:5], immlo[1:0]=bits[30:29]. Almost fully volatile.
  // ADR:  same layout. Both fully wildcard for safety.
  {
    match: (m) => m === 'adrp' || m === 'adr',
    volatile: [
      [30, 29],
      [23, 5],
    ],
  },

  // ─── Conditional branches ────────────────────────────────────────────────
  // B.cond: bits[31:24]=0x54 (always stable!), imm19=bits[23:5] (volatile),
  //         bit[4]=0, cond=bits[3:0] (stable — identifies the condition code).
  // Result: '??' '??' '??' '54' for b3, condition nibble kept in b0 low.
  {
    match: (m) => /^b\.[a-z]+$/.test(m),
    volatile: [[23, 5]],
  },

  // ─── Compare-and-branch ─────────────────────────────────────────────────
  // CBZ/CBNZ: b3 encodes opcode + operand size (e.g. 0xB4 = CBZ 64-bit).
  //           imm19 = bits[23:5] (volatile). Register Rt = bits[4:0].
  {
    match: (m) => m === 'cbz' || m === 'cbnz',
    volatile: [[23, 5]],
  },

  // ─── Test-and-branch ────────────────────────────────────────────────────
  // TBZ/TBNZ: b3 = opcode+size (stable), b[4]=0, b[3:0]=0.
  //           Bit position to test = bits[23:19] (stable — part of the logic).
  //           imm14 = bits[18:5] (volatile — branch offset).
  {
    match: (m) => m === 'tbz' || m === 'tbnz',
    volatile: [[18, 5]],
  },

  // ─── LDR literal (PC-relative, no base register) ────────────────────────
  // LDR Xt, #label: imm19 = bits[23:5] (volatile). b3 = opcode (stable).
  {
    match: (m, op) =>
      (m === 'ldr' || m === 'ldrb' || m === 'ldrh' || m === 'ldrsw') && !op.includes('['),
    volatile: [[23, 5]],
  },

  // ─── LDR/LDRB/LDRH/LDRSW with register+offset form ─────────────────────
  // LDR Xt, [Xn, #imm12]: imm12 = bits[21:10] (volatile when large/non-trivial).
  // Keeps b3 (opcode byte, e.g. 0xF9 for 64-bit LDR) and register fields.
  {
    match: (m, op) =>
      (m === 'ldr' || m === 'ldrb' || m === 'ldrh' || m === 'ldrsw') && isRegisterOffset(op),
    volatile: [[21, 10]],
  },

  // ─── STR/STRB/STRH with non-zero register and register+offset form ───────
  // Exclude stores of zero-registers (wzr/xzr) — those are likely stable
  // initializations, not address-dependent stores.
  {
    match: (m, op) =>
      (m === 'str' || m === 'strb' || m === 'strh') &&
      !op.startsWith('wzr') &&
      !op.startsWith('xzr') &&
      isRegisterOffset(op),
    volatile: [[21, 10]],
  },

  // ─── ADD/SUB with non-sp large immediate ────────────────────────────────
  // ADD Xd, Xn, #imm12: imm12 = bits[21:10].
  // sp-relative ADD is stack setup — stable. Non-sp with large imm is suspect.
  {
    match: (m, op) =>
      (m === 'add' || m === 'sub') && !op.includes('sp') && hasLargeHexImmediate(op),
    volatile: [[21, 10]],
  },

  // ─── MOV-immediate group (building absolute addresses) ───────────────────
  // MOVZ/MOVK/MOVN: imm16 = bits[20:5], hw (shift) = bits[22:21].
  // Any #0x immediate here is likely building a pointer/address.
  {
    match: (m, op) => (m === 'movz' || m === 'movk' || m === 'movn') && op.includes('#0x'),
    volatile: [[22, 5]],
  },
];

interface CompiledWildcardRule {
  match: (mnemonic: string, operand: string) => boolean;
  mask: number;
}

const COMPILED_RULES: CompiledWildcardRule[] = RAW_RULES.map((r) => ({
  match: r.match,
  mask: computeNibbleWildcardMask(r.volatile),
}));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a nibble-level mask string for the given AArch64 instruction.
 *
 * The string is 2 * instr.bytes.length characters long.
 * Each character is either '?' (wildcard this nibble) or the literal hex nibble.
 *
 * Callers should concatenate masks for all instructions and then insert spaces
 * every two characters to form a standard byte-spaced pattern.
 */
function maskInstructionWithMode(instr: Instruction, strict: boolean): string {
  const mnemonic = instr.mnemonic.toLowerCase();
  const operand = instr.op_str;
  const bytes = instr.bytes;

  for (let i = 0; i < COMPILED_RULES.length; i++) {
    const rule = COMPILED_RULES[i];
    if (rule.match(mnemonic, operand)) {
      // Portable signatures ignore register-relative offsets because fields can
      // move between builds. When a portable signature is ambiguous, retaining
      // small offsets is useful extra evidence: they are commonly stable field
      // or stack offsets and make a much stronger discriminator.
      if (
        strict &&
        isRegisterOffset(operand) &&
        !hasLargeHexImmediate(operand) &&
        /^(?:ldr(?:b|h|sw)?|str(?:b|h)?)$/.test(mnemonic)
      ) {
        return formatLiteralBytes(bytes);
      }
      return formatMaskedNibbles(bytes, rule.mask);
    }
  }

  // No rule matched → fully literal
  return formatLiteralBytes(bytes);
}

export function maskInstruction(instr: Instruction): string {
  return maskInstructionWithMode(instr, false);
}

/** A disambiguation mask that retains stable small register-relative offsets. */
export function maskInstructionStrict(instr: Instruction): string {
  return maskInstructionWithMode(instr, true);
}
