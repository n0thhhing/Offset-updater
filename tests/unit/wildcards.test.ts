import { createDisassembler } from '../../src/disassembler';
import type { Disassembler, Instruction } from '../../src/disassembler';
/**
 * Unit tests for the nibble-level wildcard mask generator (IsWildCard.ts).
 *
 * Each test feeds a synthetic Instruction object (with real ARM64 byte encodings)
 * directly into maskInstruction() and asserts the expected mask string.
 *
 * Mask format: 8 hex chars, '?' = wildcard nibble, hex char = literal nibble.
 * Byte order in mask: b0_high, b0_low, b1_high, b1_low, b2_high, b2_low, b3_high, b3_low.
 *
 * Run:  bun test tests/wildcard.test.ts
 */

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { maskInstruction } from '../../src';
import { maskInstructionStrict } from '../../src/patterns/wildcards';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Disassembles exactly 4 bytes starting at virtualAddr and returns the
 * single instruction for use in wildcard tests.
 */
function disasm1(cs: Disassembler, bytes: number[], virtualAddr = 0x1000): Instruction {
  const buf = Buffer.from(bytes);
  const instrs: Instruction[] = cs.disasm(buf, virtualAddr);
  if (instrs.length === 0)
    throw new Error(
      `Failed to disasm: ${bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`,
    );
  return instrs[0];
}

/** Formats a raw nibble mask string as spaced bytes (for readable test names). */
const spaced = (mask: string) => mask.match(/.{2}/g)!.join(' ');

// ─── Shared disassembler ──────────────────────────────────────────────────────

let cs: Disassembler;
beforeAll(() => {
  cs = createDisassembler();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('maskInstruction — fully literal instructions', () => {
  test('NOP (1f 20 03 d5) → fully literal', () => {
    const instr = disasm1(cs, [0x1f, 0x20, 0x03, 0xd5]);
    expect(spaced(maskInstruction(instr))).toBe('1f 20 03 d5');
  });

  test('RET (c0 03 5f d6) → fully literal', () => {
    const instr = disasm1(cs, [0xc0, 0x03, 0x5f, 0xd6]);
    expect(spaced(maskInstruction(instr))).toBe('c0 03 5f d6');
  });

  test('ADD X0, X0, #0x48  (00 20 01 91) → literal (small imm, no sp)', () => {
    // ADD with imm < 0x100 — hasLargeHexImmediate returns false → no rule matches → literal
    const instr = disasm1(cs, [0x00, 0x20, 0x01, 0x91]);
    expect(spaced(maskInstruction(instr))).toBe('00 20 01 91');
  });

  test('LDR X1, [X0, #0x10]  (01 08 40 f9) → literal (small offset, no rule)', () => {
    // Offset 0x10 < 0x100 threshold for isRegisterOffset check.
    // Our LDR rule fires via isRegisterOffset (checks for '[' and ','),
    // but the volatile range [21,10] masks only the imm12 bits.
    // imm12 = 0x10/8 = 2 = 0b000000000010, sits in bits[21:10].
    // All three nibbles that overlap [21,10] will be wildcarded.
    // This is intentional: even small offsets in [Xn, #imm] form are wildcarded
    // so patterns survive struct layout changes.
    const instr = disasm1(cs, [0x01, 0x08, 0x40, 0xf9]);
    const mask = maskInstruction(instr);
    expect(maskInstructionStrict(instr)).toBe('010840f9');
    // nibble4=bits[23:20] overlaps [21,10] → '?'
    // nibble5=bits[19:16] overlaps [21,10] → '?'
    // nibble2=bits[15:12] overlaps [21,10] → '?'
    // nibble3=bits[11:8]  overlaps [21,10] → '?'
    // nibble0=bits[7:4]   → max bit 7 <= 9 < 10? 7<10 → 7>=10? NO → not volatile → literal
    // Actually nibble0: nibHi=7, nibLo=4. Volatile [21,10]: 7>=10? NO → not volatile
    // nibble1: nibHi=3 < 10 → not volatile
    // nibble6: bits[31:28]=0xF → not volatile
    // nibble7: bits[27:24]=0x9 → check [21,10]: nibHi=27>=10 ✓, nibLo=24<=21? NO → not volatile
    expect(spaced(mask)).toBe('01 ?? ?? f9');
  });
});

describe('maskInstruction — PC-relative / address instructions', () => {
  test('ADRP X0, #page (80 00 00 b0) → wildcard immhi/immlo, keep Rd and opcode nibbles', () => {
    // volatile = [[30, 29], [23, 5]] preserves Rd (nibble 0) and opcode bits
    const instr = disasm1(cs, [0x80, 0x00, 0x00, 0xb0]);
    expect(spaced(maskInstruction(instr))).toBe('?0 ?? ?? ?0');
  });

  test('ADRP X2, #page (different page target, different bits) → keep Rd=2', () => {
    // Build ADRP X2 with a large page delta
    // ADRP at 0x2000 targeting page 0x30000: delta=0x2E, immlo=2, immhi=0xB
    const b = Buffer.alloc(4);
    const pc = 0x2000,
      targetPage = 0x30000;
    const delta = ((targetPage - (pc & ~0xfff)) >> 12) & 0x1fffff;
    const immlo = delta & 3;
    const immhi = (delta >> 2) & 0x7ffff;
    b.writeUInt32LE((0x90000000 | (immlo << 29) | (immhi << 5) | 2) >>> 0);
    const instr = disasm1(cs, [...b], pc);
    expect(spaced(maskInstruction(instr))).toBe('?2 ?? ?? ?0');
  });
});

describe('maskInstruction — branch instructions', () => {
  test('BL #target (fb 07 00 94) → wildcard imm26, keep opcode nibble 9', () => {
    // volatile = [[25,0]]: nibble6(bits[31:28])=0x9 → not volatile → literal '9'
    // nibble7(bits[27:24])=0x? → 27>=0 ✓ and 24<=25 ✓ → volatile
    const instr = disasm1(cs, [0xfb, 0x07, 0x00, 0x94]);
    expect(spaced(maskInstruction(instr))).toBe('?? ?? ?? 9?');
  });

  test('B #target (different positive target) → wildcard imm26, keep opcode nibble 1', () => {
    // B: bits[31:26]=0b000101, nibble6=0x1 → literal
    const buf = Buffer.alloc(4);
    const from = 0x1000,
      to = 0x2000;
    const imm26 = ((to - from) / 4) & 0x3ffffff;
    buf.writeUInt32LE((0x14000000 | imm26) >>> 0);
    const instr = disasm1(cs, [...buf], from);
    const mask = maskInstruction(instr);
    expect(mask[6]).toBe('1'); // nibble6 = high nibble of b3 = '1' for B
    expect(mask[7]).toBe('?'); // nibble7 volatile (imm26 bits 25:24 are here)
    expect(spaced(mask)).toBe(`?? ?? ?? 1?`);
  });

  test('B.EQ #target (40 01 00 54) → wildcard imm19, keep opcode 54 + cond nibble 0', () => {
    // volatile = [[23,5]]: b3=0x54 → nibble6(bits[31:28])=5 and nibble7(bits[27:24])=4 both NOT in [23,5]
    // b0 low nibble (bits[3:0]) = cond=EQ=0 → nibble1, check: nibHi=3, nibLo=0; [23,5]: 3>=5? NO → literal!
    const instr = disasm1(cs, [0x40, 0x01, 0x00, 0x54]);
    expect(spaced(maskInstruction(instr))).toBe('?0 ?? ?? 54');
  });

  test('B.NE #target → keep cond nibble 1', () => {
    const buf = Buffer.alloc(4);
    const from = 0x1000,
      to = 0x1010;
    const imm19 = ((to - from) / 4) & 0x7ffff;
    buf.writeUInt32LE((0x54000000 | (imm19 << 5) | 1) /* NE */ >>> 0);
    const instr = disasm1(cs, [...buf], from);
    expect(spaced(maskInstruction(instr))).toBe('?1 ?? ?? 54');
  });

  test('B.CS #target (cond=2) → keep cond nibble 2', () => {
    const buf = Buffer.alloc(4);
    const from = 0x1000,
      to = 0x1010;
    const imm19 = ((to - from) / 4) & 0x7ffff;
    buf.writeUInt32LE((0x54000000 | (imm19 << 5) | 2) >>> 0);
    const instr = disasm1(cs, [...buf], from);
    expect(spaced(maskInstruction(instr))).toBe('?2 ?? ?? 54');
  });
});

describe('maskInstruction — compare-and-branch', () => {
  test('CBZ X0 (64-bit) → wildcard imm19, keep opcode byte b4', () => {
    const instr = disasm1(cs, [0x60, 0x01, 0x00, 0xb4]);
    expect(spaced(maskInstruction(instr))).toBe('?0 ?? ?? b4');
  });

  test('CBNZ X1 (64-bit) → wildcard imm19, keep opcode byte b5', () => {
    const instr = disasm1(cs, [0x81, 0x01, 0x00, 0xb5]);
    expect(spaced(maskInstruction(instr))).toBe('?1 ?? ?? b5');
  });

  test('CBZ W0 (32-bit) → opcode byte is 34', () => {
    // 32-bit CBZ: bit31=0, b3=0x34
    const buf = Buffer.alloc(4);
    const from = 0x1000,
      to = 0x1020;
    const imm19 = ((to - from) / 4) & 0x7ffff;
    buf.writeUInt32LE((0x34000000 | (imm19 << 5) | 0) >>> 0);
    const instr = disasm1(cs, [...buf], from);
    const mask = maskInstruction(instr);
    expect(mask[6] + mask[7]).toBe('34');
  });
});

describe('maskInstruction — test-and-branch', () => {
  test('TBZ X0, #5 (e0 00 28 36) → wildcard imm14, keep bit-position byte', () => {
    // volatile = [[18,5]]: bit position bits[23:19] are NOT in [18,5] → partly literal
    // b3=0x36: nibble6=3, nibble7=6; bits[31:24]=36 is opcode+b5+reserved → stable
    // b2=0x28: nibble4=2, nibble5=8; bits[23:19]=bit position=5 (0b00101), bits[18:16]=imm14[13:11]
    //   nibble4(bits[23:20]): nibHi=23>=5 ✓, nibLo=20<=18? NO → not volatile (bit pos)
    //   nibble5(bits[19:16]): nibHi=19>=5 ✓, nibLo=16<=18 ✓ → volatile (imm14 starts)
    const instr = disasm1(cs, [0xe0, 0x00, 0x28, 0x36]);
    expect(spaced(maskInstruction(instr))).toBe('?0 ?? 2? 36');
  });
});

describe('maskInstruction — LDR with explicit offset', () => {
  test('LDR X2, [X0, #0x200] (02 00 41 f9) → wildcard imm12, keep opcode byte f9', () => {
    // volatile = [[21,10]]
    // nibble6(bits[31:28])=0xF → 31>=10 ✓, 28<=21? NO → not volatile → literal 'f'
    // nibble7(bits[27:24])=0x9 → 27>=10 ✓, 24<=21? NO → not volatile → literal '9'
    // nibbles 2-5 cover bits[23:16] → all overlap [21,10] → volatile
    // nibble0(bits[7:4]): nibHi=7 >= 10? NO → not volatile → literal
    // nibble1(bits[3:0]): nibHi=3 >= 10? NO → literal
    const instr = disasm1(cs, [0x02, 0x00, 0x41, 0xf9]);
    expect(spaced(maskInstruction(instr))).toBe('02 ?? ?? f9');
  });

  test('LDRB W0, [X1, #0x18] (small LDRB) → imm12 wildcarded, opcode kept', () => {
    // LDRB 8-bit: bits[31:30]=00, bits[29:27]=111, bits[25:24]=01, b3=0x39
    // imm12=0x18/1=0x18=24, in bits[21:10]
    const buf = Buffer.alloc(4);
    const rn = 1,
      rt = 0,
      offset = 0x18;
    const imm12 = (offset / 1) & 0xfff;
    buf.writeUInt32LE((0x39400000 | (imm12 << 10) | (rn << 5) | rt) >>> 0);
    const instr = disasm1(cs, [...buf]);
    const mask = maskInstruction(instr);
    // opcode nibbles (b3) should be literal: '3' and '9'
    expect(mask[6] + mask[7]).toBe('39');
  });
});

describe('maskInstruction — MOV immediate group', () => {
  test('MOVZ X0, #0x1234 (80 46 82 d2) → wildcard imm16+shift, keep opcode nibble d', () => {
    // volatile = [[22,5]]
    // nibble6(bits[31:28])=0xD → 31>=5 ✓, 28<=22? NO → not volatile → literal 'd'
    // nibble7(bits[27:24])=0x2 → 27>=5 ✓, 24<=22? NO → not volatile → literal '2'
    // nibbles 4,5 (bits[23:16]) → 23>=5 ✓, 16<=22 ✓ → volatile
    // nibble2 (bits[15:12]) → 15>=5 ✓, 12<=22 ✓ → volatile
    // nibble3 (bits[11:8]) → 11>=5 ✓, 8<=22 ✓ → volatile
    // nibble0 (bits[7:4]) → 7>=5 ✓, 4<=22 ✓ → volatile
    // nibble1 (bits[3:0]) → 3>=5? NO → literal
    const instr = disasm1(cs, [0x80, 0x46, 0x82, 0xd2]);
    expect(spaced(maskInstruction(instr))).toBe('?0 ?? ?? d2');
  });

  test('MOVK X0, #0x5678 → volatile (building upper half of address)', () => {
    // MOVK: bits[31:29]=111, bit[28]=1, bits[27:23]=10010, etc.
    const buf = Buffer.alloc(4);
    const imm16 = 0x5678;
    buf.writeUInt32LE((0xf2800000 | ((imm16 & 0xffff) << 5) | 0) >>> 0);
    const instr = disasm1(cs, [...buf]);
    // mnemonic should be 'movk', operand has #0x5678 → rule fires
    const mask = maskInstruction(instr);
    // high nibble of b3 = 0xF → in [[22,5]]: nibHi=31>=5 ✓, nibLo=28<=22? NO → literal 'f'
    expect(mask[6]).toBe('f');
    // imm16 bits should be wildcarded
    expect(mask[0]).toBe('?'); // b0 nibble0 (bits[7:4]) is in [22,5]: 7>=5 ✓, 4<=22 ✓ → volatile
  });
});

describe('maskInstruction — STR variants', () => {
  test('STR X0, [X1, #0x200] → wildcard imm12, keep opcode byte', () => {
    // X0 is not wzr/xzr, isRegisterOffset=true → rule fires
    const buf = Buffer.alloc(4);
    const rt = 0,
      rn = 1,
      offset = 0x200;
    const imm12 = (offset / 8) & 0xfff;
    buf.writeUInt32LE((0xf9000000 | (imm12 << 10) | (rn << 5) | rt) >>> 0);
    const instr = disasm1(cs, [...buf]);
    const mask = maskInstruction(instr);
    // opcode byte f9 → nibble6='f', nibble7='9' → not in volatile [21,10]
    expect(mask[6] + mask[7]).toBe('f9');
    // some middle nibbles should be wildcarded
    expect(mask.includes('?')).toBe(true);
  });

  test('STR XZR, [X1, #0x200] → fully literal (zero-register store is stable)', () => {
    // xzr (register 31) store → rule explicitly excluded
    const buf = Buffer.alloc(4);
    const rt = 31 /* xzr */,
      rn = 1,
      offset = 0x200;
    const imm12 = (offset / 8) & 0xfff;
    buf.writeUInt32LE((0xf9000000 | (imm12 << 10) | (rn << 5) | rt) >>> 0);
    const instr = disasm1(cs, [...buf]);
    const mask = maskInstruction(instr);
    // operand starts with 'xzr' → rule skipped → fully literal
    expect(mask.includes('?')).toBe(false);
  });
});

describe('maskInstruction — ADD/SUB with large immediate', () => {
  test('ADD X0, X1, #0x200 (non-sp, large imm) → wildcard imm12', () => {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE((0x91000000 | ((0x200 & 0xfff) << 10) | (1 << 5) | 0) >>> 0);
    const instr = disasm1(cs, [...buf]);
    expect(maskInstruction(instr).includes('?')).toBe(true);
  });

  test('ADD X0, SP, #0x10 → fully literal (sp-relative frame setup)', () => {
    // sp = register 31 in sp context
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE((0x91000000 | ((0x10 & 0xfff) << 10) | (31 << 5) | 0) >>> 0);
    const instr = disasm1(cs, [...buf]);
    // operand includes 'sp' → rule skipped → literal
    expect(maskInstruction(instr).includes('?')).toBe(false);
  });
});

afterAll(() => cs.close());
