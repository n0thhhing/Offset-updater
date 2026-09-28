/**
 * Comprehensive ARM64 dummy lib generator for offset-updater testing.
 *
 * Generates libs/old.so, libs/new.so, and offsets.txt containing 8 distinct
 * function archetypes that cover every wildcard rule and edge case:
 *
 *   FuncMethodLookup   — ADRP+LDR chain, CBZ, BL, BLR (IL2CPP vtable call)
 *   FuncCastCheck      — MOVZ+MOVK (48-bit address build), B.cond chain
 *   FuncLeafArith      — pure registers/stack ops, near-zero wildcards
 *   FuncAddrBuilder    — three-stage MOVZ+MOVK+MOVK chain, BR indirect jump
 *   FuncBitTester      — TBZ/TBNZ heavy, multiple bit-position tests
 *   FuncMultiCond      — 6 different B.cond codes (tests condition-nibble fidelity)
 *   FuncStrStore       — STR pattern with safe XZR exclusion
 *   FuncNearDuplicate  — same instruction sequence as MethodLookup but different
 *                        literal bytes to stress-test pattern uniqueness
 *
 * Each function is 0x80 bytes (32 instructions).  Functions are placed at
 * staggered offsets in both libs.  Callee stubs and ADRP page targets are
 * deliberately changed between old and new so all volatile nibbles differ.
 *
 * Usage:  bun run tests/gen-dummy-libs.ts
 */

// ─── AArch64 little-endian word helper ───────────────────────────────────────

const le32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};

// ─── ARM64 instruction encoders ──────────────────────────────────────────────

/** B  Xt, #target  (unconditional branch) */
const B = (from: number, to: number): Buffer => {
  const imm26 = ((to - from) / 4) & 0x3ffffff;
  return le32(0x14000000 | imm26);
};

/** BL #target  (branch-with-link) */
const BL = (from: number, to: number): Buffer => {
  const imm26 = ((to - from) / 4) & 0x3ffffff;
  return le32(0x94000000 | imm26);
};

/** BLR Xn  (indirect call through register — NO embedded address → fully literal) */
const BLR = (rn: number): Buffer => le32(0xd63f0000 | (rn << 5));

/** BR  Xn  (indirect jump through register — fully literal) */
const BR = (rn: number): Buffer => le32(0xd61f0000 | (rn << 5));

/** B.cond #target  (cond: 0=EQ 1=NE 2=CS 3=CC 4=MI 5=PL 6=VS 7=VC 8=HI 9=LS 10=GE 11=LT 12=GT 13=LE) */
const BCOND = (from: number, to: number, cond: number): Buffer => {
  const imm19 = ((to - from) / 4) & 0x7ffff;
  return le32(0x54000000 | (imm19 << 5) | cond);
};

/** CBZ  Xn, #target  (64-bit compare-and-branch-if-zero) */
const CBZ = (from: number, to: number, rt = 0): Buffer => {
  const imm19 = ((to - from) / 4) & 0x7ffff;
  return le32(0xb4000000 | (imm19 << 5) | rt);
};

/** CBNZ Xn, #target  (64-bit compare-and-branch-if-non-zero) */
const CBNZ = (from: number, to: number, rt = 0): Buffer => {
  const imm19 = ((to - from) / 4) & 0x7ffff;
  return le32(0xb5000000 | (imm19 << 5) | rt);
};

/** TBZ  Xn, #bit, #target  (test-bit-and-branch-if-zero) */
const TBZ = (from: number, to: number, rt: number, bit: number): Buffer => {
  const b5 = (bit >> 5) & 1;
  const b40 = bit & 0x1f;
  const imm14 = ((to - from) / 4) & 0x3fff;
  return le32(((b5 << 31) | 0x36000000 | (b40 << 19) | (imm14 << 5) | rt) >>> 0);
};

/** TBNZ Xn, #bit, #target */
const TBNZ = (from: number, to: number, rt: number, bit: number): Buffer => {
  const b5 = (bit >> 5) & 1;
  const b40 = bit & 0x1f;
  const imm14 = ((to - from) / 4) & 0x3fff;
  return le32(((b5 << 31) | 0x37000000 | (b40 << 19) | (imm14 << 5) | rt) >>> 0);
};

/** ADRP Xd, #targetPage  (page-relative address — PC is rounded down to 4 KB) */
const ADRP = (pc: number, targetPage: number, rd = 0): Buffer => {
  const delta = ((targetPage - (pc & ~0xfff)) >> 12) & 0x1fffff;
  const immlo = delta & 3;
  const immhi = (delta >> 2) & 0x7ffff;
  return le32((0x90000000 | (immlo << 29) | (immhi << 5) | rd) >>> 0);
};

/** ADD Xd, Xn, #imm12  (register + immediate) */
const ADD = (rd: number, rn: number, imm12: number): Buffer =>
  le32(0x91000000 | ((imm12 & 0xfff) << 10) | (rn << 5) | rd);

/** SUB Xd, Xn, #imm12 */
const SUB = (rd: number, rn: number, imm12: number): Buffer =>
  le32(0xd1000000 | ((imm12 & 0xfff) << 10) | (rn << 5) | rd);

/** ORR Xd, Xn, Xm  (bitwise or, register) */
const ORR = (rd: number, rn: number, rm: number): Buffer =>
  le32(0xaa000000 | (rm << 16) | (rn << 5) | rd);

/** CMP Xn, Xm  = SUBS XZR, Xn, Xm */
const CMP = (rn: number, rm: number): Buffer => le32(0xeb000000 | (rm << 16) | (rn << 5) | 31);

/** LDR Xt, [Xn, #imm]  (64-bit unsigned-offset load) */
const LDR64 = (rn: number, rt: number, offset: number): Buffer => {
  const imm12 = (offset / 8) & 0xfff;
  return le32(0xf9400000 | (imm12 << 10) | (rn << 5) | rt);
};

/** LDR Wt, [Xn, #imm]  (32-bit unsigned-offset load) */
const LDR32 = (rn: number, rt: number, offset: number): Buffer => {
  const imm12 = (offset / 4) & 0xfff;
  return le32(0xb9400000 | (imm12 << 10) | (rn << 5) | rt);
};

/** LDRB Wt, [Xn, #imm]  (byte load) */
const LDRB = (rn: number, rt: number, offset: number): Buffer => {
  const imm12 = offset & 0xfff;
  return le32(0x39400000 | (imm12 << 10) | (rn << 5) | rt);
};

/** STR Xt, [Xn, #imm]  (64-bit unsigned-offset store) */
const STR64 = (rt: number, rn: number, offset: number): Buffer => {
  const imm12 = (offset / 8) & 0xfff;
  return le32(0xf9000000 | (imm12 << 10) | (rn << 5) | rt);
};

/** STR Wt, [Xn, #imm]  (32-bit store) */
const STR32 = (rt: number, rn: number, offset: number): Buffer => {
  const imm12 = (offset / 4) & 0xfff;
  return le32(0xb9000000 | (imm12 << 10) | (rn << 5) | rt);
};

/** STRB Wt, [Xn, #imm]  (byte store) */
const STRB = (rt: number, rn: number, offset: number): Buffer => {
  const imm12 = offset & 0xfff;
  return le32(0x39000000 | (imm12 << 10) | (rn << 5) | rt);
};

/** MOVZ Xd, #imm16, LSL #shift  (move with zero) */
const MOVZ = (rd: number, imm16: number, shift = 0): Buffer =>
  le32(0xd2800000 | (((shift / 16) & 3) << 21) | ((imm16 & 0xffff) << 5) | rd);

/** MOVK Xd, #imm16, LSL #shift  (move with keep) */
const MOVK = (rd: number, imm16: number, shift = 0): Buffer =>
  le32(0xf2800000 | (((shift / 16) & 3) << 21) | ((imm16 & 0xffff) << 5) | rd);

const NOP = le32(0xd503201f);
const RET = le32(0xd65f03c0);

// ─── Padding ─────────────────────────────────────────────────────────────────

const FUNC_SIZE = 0x80; // Each function slot is 128 bytes (32 instructions)
const LIB_SIZE = 0xc000; // 48 KB total

function buildLib(size: number): Buffer {
  return Buffer.alloc(size, 0xcc); // 0xcc = BRK #0x0 in some interpretations, clearly not a valid sequence
}

function placeAt(lib: Buffer, offset: number, code: Buffer): void {
  if (code.length > FUNC_SIZE) throw new Error(`code too large: ${code.length} > ${FUNC_SIZE}`);
  code.copy(lib, offset);
  // Fill remainder of slot with NOPs
  const nopCount = (FUNC_SIZE - code.length) / 4;
  for (let i = 0; i < nopCount; i++) NOP.copy(lib, offset + code.length + i * 4);
}

// ─── Function builders ────────────────────────────────────────────────────────
//
// Each builder takes:
//   base       — virtual address (also byte offset into lib) of the function
//   callee     — address of the callee stub to call via BL
//   page1/2    — page addresses for ADRP instructions
//   imm16_*    — immediate values for MOVZ/MOVK (address-building)
//
// What CHANGES between old and new:
//   • base (function moves)
//   • callee (callee stub moves)
//   • page1/2 (object/string table pages move)
//   • imm16_* (address literals change)
//
// What STAYS THE SAME:
//   • Instruction sequence and opcode bytes
//   • Register assignments
//   • Small struct/field offsets in LDR/STR
//   • Relative branch distances within the function (same # instructions)
//   • Condition codes in B.cond

// ── 1. IL2CPP method table lookup (ADRP+LDR chain, CBZ, BL, BLR) ─────────────
function buildMethodLookup(base: number, callee: number, page1: number, page2: number): Buffer {
  const b = base;
  return Buffer.concat([
    /* +0x00 */ SUB(31, 31, 0x20), // sub sp, sp, #0x20  — literal (sp-relative)
    /* +0x04 */ ADRP(b + 0x04, page1, 8), // adrp x8, #method_table_page  — volatile
    /* +0x08 */ LDR64(8, 8, 0x30), // ldr x8, [x8, #0x30]  — wildcard imm12
    /* +0x0c */ CBZ(b + 0x0c, b + 0x58, 8), // cbz x8, #end  — volatile offset, keep b4
    /* +0x10 */ ADRP(b + 0x10, page2, 1), // adrp x1, #string_page  — volatile
    /* +0x14 */ ADD(1, 1, 0x78), // add x1, x1, #0x78  — literal (small imm < 0x100)
    /* +0x18 */ LDR64(8, 0, 0x08), // ldr x0, [x8, #0x08]  — wildcard imm12
    /* +0x1c */ BL(b + 0x1c, callee), // bl #resolve  — volatile, keep '9'
    /* +0x20 */ CBZ(b + 0x20, b + 0x58, 0), // cbz x0, #end  — volatile
    /* +0x24 */ LDR64(0, 1, 0x10), // ldr x1, [x0, #0x10] vtable — wildcard
    /* +0x28 */ BLR(1), // blr x1  — fully literal (no embedded address)
    /* +0x2c */ ADD(31, 31, 0x20), // add sp, sp, #0x20  — literal (sp-relative)
    /* +0x30 */ RET, // ret  — literal
  ]);
}

// ── 2. IL2CPP cast-check (MOVZ+MOVK 48-bit address, B.cond chain) ─────────────
function buildCastCheck(base: number, callee: number, imm16_lo: number, imm16_hi: number): Buffer {
  const b = base;
  return Buffer.concat([
    /* +0x00 */ NOP,
    /* +0x04 */ MOVZ(2, imm16_lo, 0), // movz x2, #lo  — volatile imm16
    /* +0x08 */ MOVK(2, imm16_hi, 16), // movk x2, #hi, lsl #16  — volatile
    /* +0x0c */ CMP(0, 2), // cmp x0, x2  — literal
    /* +0x10 */ BCOND(b + 0x10, b + 0x40, 1), // b.ne #end  — volatile offset, keep cond '1'
    /* +0x14 */ LDR64(0, 3, 0x18), // ldr x3, [x0, #0x18]  — wildcard imm12
    /* +0x18 */ CBZ(b + 0x18, b + 0x40, 3), // cbz x3, #end
    /* +0x1c */ BL(b + 0x1c, callee), // bl #check_cast
    /* +0x20 */ BCOND(b + 0x20, b + 0x40, 0), // b.eq #end  — volatile, keep cond '0'
    /* +0x24 */ BCOND(b + 0x24, b + 0x44, 11), // b.lt #throw  — volatile, keep cond 'b'
    /* +0x28 */ LDR64(0, 0, 0x20), // ldr x0, [x0, #0x20]
    /* +0x2c */ RET,
  ]);
}

// ── 3. Leaf arithmetic (near-all-literal — no ADRP/BL/branches) ─────────────
// Changes between old/new: nothing except base address (relative branches all stay same)
// Expected: pattern is almost entirely literal bytes = very high uniqueness
function buildLeafArith(base: number): Buffer {
  // No base-dependent instructions at all — static code
  return Buffer.concat([
    /* +0x00 */ SUB(31, 31, 0x10), // sub sp, sp, #0x10  — literal
    /* +0x04 */ STR64(0, 31, 0x00), // str x0, [sp, #0x00]  — wildcard (str rule)
    /* +0x08 */ STR64(1, 31, 0x08), // str x1, [sp, #0x08]  — wildcard
    /* +0x0c */ LDR64(31, 0, 0x00), // ldr x0, [sp, #0x00]  — wildcard imm12
    /* +0x10 */ LDR64(31, 1, 0x08), // ldr x1, [sp, #0x08]  — wildcard
    /* +0x14 */ ORR(2, 0, 1), // orr x2, x0, x1  — literal
    /* +0x18 */ CMP(2, 0), // cmp x2, x0  — literal
    /* +0x1c */ ADD(0, 2, 0x04), // add x0, x2, #4  — literal (small imm)
    /* +0x20 */ ADD(31, 31, 0x10), // add sp, sp, #0x10  — literal (sp-relative)
    /* +0x24 */ RET,
  ]);
}

// ── 4. Three-stage address builder (MOVZ + MOVK×2 + BR indirect jump) ────────
function buildAddrBuilder(base: number, imm16_0: number, imm16_1: number, imm16_2: number): Buffer {
  return Buffer.concat([
    /* +0x00 */ NOP,
    /* +0x04 */ MOVZ(0, imm16_0, 0), // movz x0, #lo16  — volatile
    /* +0x08 */ MOVK(0, imm16_1, 16), // movk x0, #mid16, lsl#16  — volatile
    /* +0x0c */ MOVK(0, imm16_2, 32), // movk x0, #hi16, lsl#32  — volatile
    /* +0x10 */ CMP(0, 1), // cmp x0, x1  — literal
    /* +0x14 */ BCOND(base + 0x14, base + 0x28, 0), // b.eq #skip  — volatile, keep cond '0'
    /* +0x18 */ ORR(2, 0, 1), // orr x2, x0, x1  — literal
    /* +0x1c */ ADD(3, 2, 0x04), // add x3, x2, #4  — literal
    /* +0x20 */ BR(0), // br x0  — fully literal (no embedded address)
    /* +0x24 */ RET,
  ]);
}

// ── 5. Bit tester (TBZ/TBNZ heavy) ───────────────────────────────────────────
function buildBitTester(base: number, callee: number): Buffer {
  const b = base;
  return Buffer.concat([
    /* +0x00 */ LDR64(0, 8, 0x10), // ldr x8, [x0, #0x10]  — wildcard imm12
    /* +0x04 */ TBZ(b + 0x04, b + 0x2c, 8, 0), // tbz x8, #0, #end  — volatile, keep opcode+bit
    /* +0x08 */ TBZ(b + 0x08, b + 0x2c, 8, 3), // tbz x8, #3, #end  — volatile, keep bit '3'
    /* +0x0c */ TBNZ(b + 0x0c, b + 0x2c, 8, 7), // tbnz x8, #7, #end  — volatile, keep bit '7'
    /* +0x10 */ ADD(8, 8, 0x08), // add x8, x8, #8  — literal (small imm)
    /* +0x14 */ TBZ(b + 0x14, b + 0x2c, 8, 1), // tbz x8, #1, #end
    /* +0x18 */ TBNZ(b + 0x18, b + 0x2c, 8, 5), // tbnz x8, #5, #end
    /* +0x1c */ BL(b + 0x1c, callee), // bl #process  — volatile, keep '9'
    /* +0x20 */ CMP(0, 8), // cmp x0, x8  — literal
    /* +0x24 */ BCOND(b + 0x24, b + 0x2c, 1), // b.ne #end
    /* +0x28 */ ORR(0, 0, 8), // orr x0, x0, x8  — literal
    /* +0x2c */ RET,
  ]);
}

// ── 6. Multi-condition (6 different B.cond codes — tests condition-nibble fidelity) ──
function buildMultiCond(base: number, callee: number): Buffer {
  const b = base;
  return Buffer.concat([
    /* +0x00 */ CMP(0, 1), // cmp x0, x1  — literal (1f 00 01 eb)
    /* +0x04 */ BCOND(b + 0x04, b + 0x44, 0), // b.eq  — keep cond '0'
    /* +0x08 */ BCOND(b + 0x08, b + 0x44, 1), // b.ne  — keep cond '1'
    /* +0x0c */ BCOND(b + 0x0c, b + 0x44, 10), // b.ge  — keep cond 'a'
    /* +0x10 */ BCOND(b + 0x10, b + 0x44, 11), // b.lt  — keep cond 'b'
    /* +0x14 */ BCOND(b + 0x14, b + 0x44, 12), // b.gt  — keep cond 'c'
    /* +0x18 */ BCOND(b + 0x18, b + 0x44, 13), // b.le  — keep cond 'd'
    /* +0x1c */ BL(b + 0x1c, callee), // bl #handler
    /* +0x20 */ CMP(0, 2), // cmp x0, x2  — literal
    /* +0x24 */ BCOND(b + 0x24, b + 0x44, 8), // b.hi  — keep cond '8'
    /* +0x28 */ ORR(3, 0, 1), // orr x3, x0, x1  — literal
    /* +0x2c */ ADD(0, 3, 0x02), // add x0, x3, #2  — literal (small imm)
    /* +0x30 */ RET,
  ]);
}

// ── 7. Store pattern (STR/STRB with XZR exclusion rule) ──────────────────────
function buildStrStore(base: number, page1: number): Buffer {
  const b = base;
  return Buffer.concat([
    /* +0x00 */ ADRP(b + 0x00, page1, 0), // adrp x0, #page  — volatile
    /* +0x04 */ LDR64(0, 1, 0x40), // ldr x1, [x0, #0x40]  — wildcard imm12
    /* +0x08 */ STR64(31, 0, 0x08), // str xzr, [x0, #0x08]  — LITERAL (xzr exclusion!)
    /* +0x0c */ STR64(1, 0, 0x18), // str x1, [x0, #0x18]  — wildcard (x1 not xzr)
    /* +0x10 */ STRB(31, 0, 0x04), // strb wzr, [x0, #0x04]  — LITERAL (wzr exclusion)
    /* +0x14 */ STR32(2, 0, 0x20), // str w2, [x0, #0x20]  — wildcard
    /* +0x18 */ LDRB(0, 3, 0x01), // ldrb w3, [x0, #0x01]  — wildcard
    /* +0x1c */ CMP(1, 2), // cmp x1, x2  — literal
    /* +0x20 */ BCOND(b + 0x20, b + 0x34, 1), // b.ne #end  — volatile, keep cond '1'
    /* +0x24 */ STR64(1, 0, 0x28), // str x1, [x0, #0x28]  — wildcard
    /* +0x28 */ LDR64(0, 0, 0x50), // ldr x0, [x0, #0x50]  — wildcard
    /* +0x2c */ ORR(0, 0, 1), // orr x0, x0, x1  — literal
    /* +0x30 */ RET,
  ]);
}

// ── 8. Near-duplicate (same structure as MethodLookup but distinct register mix) ──
// Uses different registers + different small immediates to produce different literal bytes
function buildNearDuplicate(base: number, callee: number, page1: number, page2: number): Buffer {
  const b = base;
  return Buffer.concat([
    /* +0x00 */ SUB(31, 31, 0x30), // sub sp, sp, #0x30  ← DIFFERENT from MethodLookup
    /* +0x04 */ ADRP(b + 0x04, page1, 9), // adrp x9, #page  — volatile (different dest reg x9)
    /* +0x08 */ LDR64(9, 9, 0x58), // ldr x9, [x9, #0x58]  ← DIFFERENT offset
    /* +0x0c */ CBZ(b + 0x0c, b + 0x58, 9), // cbz x9, #end  — volatile, opcode b4
    /* +0x10 */ ADRP(b + 0x10, page2, 2), // adrp x2, #page  — volatile (different dest reg x2)
    /* +0x14 */ ADD(2, 2, 0x90), // add x2, x2, #0x90  ← DIFFERENT imm (still literal since <0x100)
    /* +0x18 */ LDR64(9, 3, 0x40), // ldr x3, [x9, #0x40]  ← DIFFERENT registers+offset
    /* +0x1c */ BL(b + 0x1c, callee), // bl #resolve
    /* +0x20 */ CBZ(b + 0x20, b + 0x58, 3), // cbz x3, #end  — volatile
    /* +0x24 */ LDR64(3, 4, 0x18), // ldr x4, [x3, #0x18]  ← DIFFERENT
    /* +0x28 */ BLR(4), // blr x4  ← DIFFERENT register
    /* +0x2c */ ADD(31, 31, 0x30), // add sp, sp, #0x30  ← DIFFERENT
    /* +0x30 */ RET,
  ]);
}

// ─── Lib layout ──────────────────────────────────────────────────────────────

// Old lib layout  (callees at 0x8000–0x8200, ADRP pages at 0x10000+)
const OLD: Record<string, number> = {
  MethodLookup: 0x0100,
  CastCheck: 0x0200,
  LeafArith: 0x0300,
  AddrBuilder: 0x0400,
  BitTester: 0x0500,
  MultiCond: 0x0600,
  StrStore: 0x0700,
  NearDuplicate: 0x0800,
  // Callee stubs
  callee1: 0x8000,
  callee2: 0x8080,
  callee3: 0x8100,
  callee4: 0x8180,
  // ADRP page targets (not necessarily in the lib, just page addresses for ADRP calc)
  page1: 0x10000,
  page2: 0x20000,
  page3: 0x30000,
};

// New lib layout  (functions all relocated, callees at 0x9000+, pages shifted)
const NEW: Record<string, number> = {
  MethodLookup: 0x1100, // shifted by +0x1000
  CastCheck: 0x1300, // shifted by +0x1100
  LeafArith: 0x1500, // shifted by +0x1200
  AddrBuilder: 0x1700, // shifted by +0x1300
  BitTester: 0x1900, // shifted by +0x1400
  MultiCond: 0x1b00, // shifted by +0x1500
  StrStore: 0x1d00, // shifted by +0x1600
  NearDuplicate: 0x1f00, // shifted by +0x1700
  callee1: 0x9000,
  callee2: 0x9080,
  callee3: 0x9100,
  callee4: 0x9180,
  page1: 0x15000, // different pages
  page2: 0x25000,
  page3: 0x35000,
};

const oldLib = buildLib(LIB_SIZE);
const newLib = buildLib(LIB_SIZE);

// ── Build and place all functions ─────────────────────────────────────────────

const funcs: Array<{ name: string; oldOff: number; newOff: number }> = [];

function place(name: keyof typeof OLD, oldCode: Buffer, newCode: Buffer): void {
  placeAt(oldLib, OLD[name], oldCode);
  placeAt(newLib, NEW[name], newCode);
  funcs.push({ name, oldOff: OLD[name], newOff: NEW[name] });
}

place(
  'MethodLookup',
  buildMethodLookup(OLD.MethodLookup, OLD.callee1, OLD.page1, OLD.page2),
  buildMethodLookup(NEW.MethodLookup, NEW.callee1, NEW.page1, NEW.page2),
);

place(
  'CastCheck',
  buildCastCheck(OLD.CastCheck, OLD.callee2, 0x1234, 0x5678),
  buildCastCheck(NEW.CastCheck, NEW.callee2, 0xabcd, 0xef01), // different address literals
);

place(
  'LeafArith',
  buildLeafArith(OLD.LeafArith),
  buildLeafArith(NEW.LeafArith), // identical code — no volatile instructions
);

place(
  'AddrBuilder',
  buildAddrBuilder(OLD.AddrBuilder, 0x1234, 0x5678, 0x0090),
  buildAddrBuilder(NEW.AddrBuilder, 0xabcd, 0xef01, 0x0042), // different 48-bit address
);

place(
  'BitTester',
  buildBitTester(OLD.BitTester, OLD.callee3),
  buildBitTester(NEW.BitTester, NEW.callee3),
);

place(
  'MultiCond',
  buildMultiCond(OLD.MultiCond, OLD.callee4),
  buildMultiCond(NEW.MultiCond, NEW.callee4),
);

place('StrStore', buildStrStore(OLD.StrStore, OLD.page3), buildStrStore(NEW.StrStore, NEW.page3));

place(
  'NearDuplicate',
  buildNearDuplicate(OLD.NearDuplicate, OLD.callee1, OLD.page1, OLD.page2),
  buildNearDuplicate(NEW.NearDuplicate, NEW.callee1, NEW.page1, NEW.page2),
);

export { oldLib, newLib, funcs };
