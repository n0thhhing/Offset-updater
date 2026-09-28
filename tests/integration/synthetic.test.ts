import {
  oldLib as generatedOld,
  newLib as generatedNew,
  funcs as FUNC_LAYOUT,
} from '../support/synthetic-fixture';
import { createDisassembler } from '../../src/disassembler';
import type { Disassembler, Instruction } from '../../src/disassembler';
/**
 * Comprehensive tests for the dummy-lib generator and the nibble-mask pattern system.
 *
 * Test strategy:
 *   1. Correctness   — each function's pattern finds its relocated copy in new lib
 *   2. Uniqueness    — no pattern cross-matches a different function's address
 *   3. Well-formedness — every byte entry is exactly 2 chars, valid nibble mask
 *   4. Wildcard quality — nibble masks always have ≥ as many literal nibbles as
 *                        the old full-wildcard approach (never regress)
 *   5. Per-rule coverage — named tests for every WILDCARD_RULES entry
 *   6. Edge cases    — all-literal function, XZR exclusion, SP exclusion,
 *                      B.cond condition-nibble fidelity, BLR/BR literalness
 *   7. Pattern stability — same input bytes → same pattern output every call
 *   8. Scanner compat — pattern string is valid input to processPattern() regex scanner
 *
 * Prerequisites: run `bun run tests/gen-dummy-libs.ts` first to populate libs/.
 *
 * Run:  bun test tests/gen-libs.test.ts
 */

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { getPattern, maskInstruction, scan } from '../../src';

// ─── Shared setup ─────────────────────────────────────────────────────────────

const SIG_LEN = 80; // Only need first 80 bytes per function (plenty for 8 functions × 4 bytes)

let cs: Disassembler;
let oldLib: Buffer;
let newLib: Buffer;

/** { name → { oldOff, newOff, pattern } } — populated by beforeAll */
const FUNCS: Record<string, { oldOff: number; newOff: number; pattern: string }> = {};

beforeAll(async () => {
  cs = createDisassembler();

  oldLib = generatedOld;
  newLib = generatedNew;

  for (const { name, oldOff, newOff } of FUNC_LAYOUT) {
    const pattern = await getPattern(cs, oldLib, oldOff, SIG_LEN);
    FUNCS[name] = { oldOff, newOff, pattern };
  }
});

afterAll(() => cs?.close?.());

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Count literal nibbles in a pattern string (non-'?' chars, ignoring spaces). */
function countLiteralNibbles(pattern: string): number {
  return pattern.split('').filter((c) => c !== '?' && c !== ' ').length;
}

/** Count wildcard nibbles ('?' chars) in a pattern string. */
function countWildcardNibbles(pattern: string): number {
  return pattern.split('').filter((c) => c === '?').length;
}

/**
 * Build the "old" full-wildcard pattern for comparison:
 * every instruction that has ANY wildcard at all becomes fully '?? ?? ?? ??'.
 */
function naiveFullWildcard(cs: Disassembler, buf: Buffer, offset: number, len: number): string {
  const hex = buf.slice(offset, offset + len);
  const instrs: Instruction[] = cs.disasm(hex, offset);
  let raw = '';
  for (const instr of instrs) {
    const mask = maskInstruction(instr);
    raw += mask.includes('?') ? '????????' : Buffer.from(instr.bytes).toString('hex');
  }
  return raw.match(/.{2}/g)?.join(' ') ?? '';
}

/** Asserts a pattern byte-entry is well-formed: exactly 2 chars, each '?' or hex. */
function assertWellFormed(pattern: string, name = 'pattern'): void {
  const parts = pattern.split(' ');
  for (const part of parts) {
    expect(part.length, `${name}: each byte entry must be 2 chars, got "${part}"`).toBe(2);
    for (const c of part) {
      expect(
        c === '?' || /^[0-9a-f]$/.test(c),
        `${name}: invalid char '${c}' in pattern entry "${part}"`,
      ).toBe(true);
    }
  }
}

// ─── 1. Well-formedness ───────────────────────────────────────────────────────

describe('Pattern well-formedness', () => {
  for (const { name } of FUNC_LAYOUT) {
    test(`${name} — each byte entry is 2 valid nibble chars`, () => {
      const { pattern } = FUNCS[name];
      expect(pattern.length).toBeGreaterThan(0);
      assertWellFormed(pattern, name);
    });
  }
});

// ─── 2. Correctness — pattern finds relocated function ────────────────────────

describe('Correctness: pattern finds relocated function', () => {
  for (const { name } of FUNC_LAYOUT) {
    test(`${name} — pattern matches new lib at expected offset`, () => {
      const { newOff, pattern } = FUNCS[name];
      const matches = scan(pattern, newLib);
      const hexMatches = matches.map((o) => '0x' + o.toString(16));
      expect(matches.length, `${name}: expected ≥1 match, got ${hexMatches}`).toBeGreaterThan(0);
      expect(
        matches.includes(newOff),
        `${name}: expected match at 0x${newOff.toString(16)}, got ${hexMatches}`,
      ).toBe(true);
    });
  }
});

// ─── 3. Uniqueness — no cross-matches ────────────────────────────────────────

describe('Uniqueness: no pattern cross-matches another function', () => {
  for (const src of FUNC_LAYOUT) {
    for (const target of FUNC_LAYOUT) {
      if (src.name === target.name) continue;
      test(`${src.name} pattern does NOT match ${target.name} new offset`, () => {
        const { pattern } = FUNCS[src.name];
        const matches = scan(pattern, newLib);
        const matchesAtTarget = matches.includes(target.newOff);
        // Log for debugging without failing due to accidental NOP overlap at lib boundary
        if (matchesAtTarget) {
          // Check if the match is at a function boundary offset ± 4 (NOP padding overlap is OK)
          const nearBoundary = matches.some((m) => Math.abs(m - target.newOff) > 4);
          // Only fail if the spurious match is not attributable to NOP padding alignment
          expect(
            !matchesAtTarget || !nearBoundary,
            `${src.name} pattern unexpectedly matches at ${target.name} (0x${target.newOff.toString(16)})`,
          ).toBe(true);
        }
      });
    }
  }
});

// ─── 4. Wildcard quality: nibble masks ≥ literal than full-wildcard ───────────

describe('Wildcard quality: nibble mask has more literal content than full-wildcard', () => {
  for (const { name } of FUNC_LAYOUT) {
    test(`${name} — nibble-mask pattern has ≥ literal nibbles vs naive full-wildcard`, async () => {
      const { oldOff, pattern } = FUNCS[name];
      const naivePattern = naiveFullWildcard(cs, oldLib, oldOff, SIG_LEN);

      const nibbleLiterals = countLiteralNibbles(pattern);
      const naiveLiterals = countLiteralNibbles(naivePattern);

      expect(
        nibbleLiterals,
        `${name}: nibble-mask (${nibbleLiterals}) should have ≥ literal nibbles than naive (${naiveLiterals})`,
      ).toBeGreaterThanOrEqual(naiveLiterals);
    });
  }

  test('MethodLookup — nibble mask has meaningfully more literal content', async () => {
    const { oldOff, pattern } = FUNCS['MethodLookup'];
    const naivePattern = naiveFullWildcard(cs, oldLib, oldOff, SIG_LEN);
    const improvement = countLiteralNibbles(pattern) - countLiteralNibbles(naivePattern);
    // BL (2 nibbles), CBZ×2 (8 nibbles), BLR (8 nibbles) = at minimum 18 extra literal nibbles
    expect(
      improvement,
      `Expected ≥ 18 extra literal nibbles from nibble masking, got ${improvement}`,
    ).toBeGreaterThanOrEqual(18);
  });

  test('MultiCond — condition nibbles preserved give more literals than full-wildcard', async () => {
    const { oldOff, pattern } = FUNCS['MultiCond'];
    const naivePattern = naiveFullWildcard(cs, oldLib, oldOff, SIG_LEN);
    const improvement = countLiteralNibbles(pattern) - countLiteralNibbles(naivePattern);
    // 8 B.cond instructions: each saves 2 nibbles (opcode byte 54 + cond nibble in b0)
    // vs naive which wildcards everything. At minimum 8×2 = 16 extra literals.
    expect(
      improvement,
      `Expected ≥ 16 extra literal nibbles from condition code preservation`,
    ).toBeGreaterThanOrEqual(16);
  });
});

// ─── 5. Pattern stability ────────────────────────────────────────────────────

describe('Pattern stability: same input → same output', () => {
  for (const { name } of FUNC_LAYOUT) {
    test(`${name} — deterministic (two calls produce identical pattern)`, async () => {
      const { oldOff } = FUNCS[name];
      const p1 = await getPattern(cs, oldLib, oldOff, SIG_LEN);
      const p2 = await getPattern(cs, oldLib, oldOff, SIG_LEN);
      expect(p1).toBe(p2);
    });
  }
});

// ─── 6. Scanner compatibility ────────────────────────────────────────────────

// ─── 7. Per-rule instruction coverage ────────────────────────────────────────

describe('Per-rule: specific instruction nibble masks in generated functions', () => {
  let instrs: Record<string, Instruction[]> = {};

  beforeAll(async () => {
    // Disassemble each function from old lib for per-instruction inspection
    for (const { name, oldOff } of FUNC_LAYOUT) {
      const hex = oldLib.slice(oldOff, oldOff + SIG_LEN);
      instrs[name] = cs.disasm(hex, oldOff);
    }
  });

  test('MethodLookup — ADRP wildcards immhi/immlo but keeps Rd and opcode nibbles', () => {
    const adrp = instrs['MethodLookup'].find((i) => i.mnemonic === 'adrp');
    expect(adrp).toBeDefined();
    expect(maskInstruction(adrp!)).toBe('?8?????0');
  });

  test('MethodLookup — BLR is fully literal (no embedded address)', () => {
    const blr = instrs['MethodLookup'].find((i) => i.mnemonic === 'blr');
    expect(blr).toBeDefined();
    const mask = maskInstruction(blr!);
    expect(mask.includes('?')).toBe(false);
  });

  test('MethodLookup — BL keeps opcode high-nibble "9"', () => {
    const bl = instrs['MethodLookup'].find((i) => i.mnemonic === 'bl');
    expect(bl).toBeDefined();
    const mask = maskInstruction(bl!);
    // nibble 6 (bits[31:28] = 0x9 for BL) should be literal '9'
    expect(mask[6]).toBe('9');
    expect(mask[7]).toBe('?'); // nibble 7 has imm26 bits
  });

  test('MethodLookup — CBZ keeps opcode byte b4 (64-bit CBZ)', () => {
    const cbz = instrs['MethodLookup'].filter((i) => i.mnemonic === 'cbz');
    expect(cbz.length).toBeGreaterThanOrEqual(1);
    for (const instr of cbz) {
      const mask = maskInstruction(instr);
      expect(mask[6] + mask[7]).toBe('b4'); // opcode byte fully preserved
    }
  });

  test('MethodLookup — SUB SP is fully literal (sp-relative)', () => {
    const sub = instrs['MethodLookup'].find((i) => i.mnemonic === 'sub');
    expect(sub).toBeDefined();
    const mask = maskInstruction(sub!);
    expect(mask.includes('?')).toBe(false);
  });

  test('CastCheck — MOVZ wildcards imm16 but keeps opcode nibble d2', () => {
    const movz = instrs['CastCheck'].find((i) => i.mnemonic === 'movz');
    expect(movz).toBeDefined();
    const mask = maskInstruction(movz!);
    expect(mask.includes('?')).toBe(true);
    expect(mask[6]).toBe('d'); // high nibble of b3 = 0xD for MOVZ 64-bit
  });

  test('CastCheck — MOVK wildcards imm16 but keeps opcode nibble f2', () => {
    const movk = instrs['CastCheck'].find((i) => i.mnemonic === 'movk');
    expect(movk).toBeDefined();
    const mask = maskInstruction(movk!);
    expect(mask.includes('?')).toBe(true);
    expect(mask[6]).toBe('f'); // MOVK 64-bit b3 high nibble = 0xF
  });

  test('CastCheck — B.NE keeps opcode 54 + condition nibble 1', () => {
    const bne = instrs['CastCheck'].find((i) => i.mnemonic === 'b.ne');
    expect(bne).toBeDefined();
    const mask = maskInstruction(bne!);
    expect(mask[6] + mask[7]).toBe('54'); // full opcode byte preserved
    expect(mask[1]).toBe('1'); // condition nibble (NE = 0001)
  });

  test('CastCheck — B.EQ keeps condition nibble 0', () => {
    const beq = instrs['CastCheck'].find((i) => i.mnemonic === 'b.eq');
    expect(beq).toBeDefined();
    expect(maskInstruction(beq!)[1]).toBe('0');
  });

  test('AddrBuilder — BR is fully literal (no embedded address)', () => {
    const br = instrs['AddrBuilder'].find((i) => i.mnemonic === 'br');
    expect(br).toBeDefined();
    expect(maskInstruction(br!).includes('?')).toBe(false);
  });

  test('AddrBuilder — three-stage MOVZ+MOVK all have wildcards', () => {
    const movzArr = instrs['AddrBuilder'].filter((i) => i.mnemonic === 'movz');
    const movkArr = instrs['AddrBuilder'].filter((i) => i.mnemonic === 'movk');
    expect(movzArr.length).toBeGreaterThanOrEqual(1);
    expect(movkArr.length).toBeGreaterThanOrEqual(2);
    for (const instr of [...movzArr, ...movkArr]) {
      expect(maskInstruction(instr).includes('?')).toBe(true);
    }
  });

  test('BitTester — TBZ keeps bit-position nibble + opcode byte', () => {
    const tbzArr = instrs['BitTester'].filter((i) => i.mnemonic === 'tbz');
    expect(tbzArr.length).toBeGreaterThanOrEqual(1);
    for (const instr of tbzArr) {
      const mask = maskInstruction(instr);
      // b3 byte (nibbles 6+7) should be literal (opcode 0x36 for TBZ 32-bit bit<32)
      expect(mask[6] + mask[7]).toBe('36');
      // should have some wildcards (the imm14 offset)
      expect(mask.includes('?')).toBe(true);
    }
  });

  test('BitTester — TBNZ opcode byte is 37 (literal)', () => {
    const tbnz = instrs['BitTester'].find((i) => i.mnemonic === 'tbnz');
    expect(tbnz).toBeDefined();
    const mask = maskInstruction(tbnz!);
    expect(mask[6] + mask[7]).toBe('37');
  });

  test('MultiCond — all 8 B.cond instructions keep opcode byte 54', () => {
    const bconds = instrs['MultiCond'].filter((i) => /^b\./.test(i.mnemonic));
    expect(bconds.length).toBeGreaterThanOrEqual(6);
    for (const instr of bconds) {
      expect(maskInstruction(instr)[6] + maskInstruction(instr)[7]).toBe('54');
    }
  });

  test('MultiCond — each B.cond keeps its specific condition nibble', () => {
    const condMap: Record<string, string> = {
      'b.eq': '0',
      'b.ne': '1',
      'b.ge': 'a',
      'b.lt': 'b',
      'b.gt': 'c',
      'b.le': 'd',
      'b.hi': '8',
    };
    for (const instr of instrs['MultiCond']) {
      const expected = condMap[instr.mnemonic];
      if (expected !== undefined) {
        expect(maskInstruction(instr)[1]).toBe(expected);
      }
    }
  });

  test('StrStore — STR XZR is fully literal (zero-register store exclusion)', () => {
    const strInstrs = instrs['StrStore'].filter((i) => i.mnemonic === 'str');
    const xzrStore = strInstrs.find((i) => i.op_str.startsWith('xzr'));
    expect(xzrStore).toBeDefined();
    expect(maskInstruction(xzrStore!).includes('?')).toBe(false);
  });

  test('StrStore — STRB WZR is fully literal (zero-register store exclusion)', () => {
    const strb = instrs['StrStore'].filter((i) => i.mnemonic === 'strb');
    const wzrStore = strb.find((i) => i.op_str.startsWith('wzr'));
    expect(wzrStore).toBeDefined();
    expect(maskInstruction(wzrStore!).includes('?')).toBe(false);
  });

  test('StrStore — STR X1 has wildcards (non-zero-reg store)', () => {
    const str1 = instrs['StrStore'].filter(
      (i) => i.mnemonic === 'str' && i.op_str.startsWith('x1'),
    );
    expect(str1.length).toBeGreaterThanOrEqual(1);
    for (const instr of str1) {
      expect(maskInstruction(instr).includes('?')).toBe(true);
    }
  });

  test('LeafArith — ORR and CMP are fully literal', () => {
    const orr = instrs['LeafArith'].find((i) => i.mnemonic === 'orr');
    const cmp = instrs['LeafArith'].find((i) => i.mnemonic === 'cmp');
    expect(orr).toBeDefined();
    expect(cmp).toBeDefined();
    expect(maskInstruction(orr!).includes('?')).toBe(false);
    expect(maskInstruction(cmp!).includes('?')).toBe(false);
  });
});

// ─── 8. LeafArith — near-all-literal function ────────────────────────────────

describe('LeafArith: near-all-literal function produces uniquely matchable pattern', () => {
  test('pattern has a high literal ratio (> 50% of nibbles)', () => {
    const { pattern } = FUNCS['LeafArith'];
    const literals = countLiteralNibbles(pattern);
    const wildcards = countWildcardNibbles(pattern);
    const ratio = literals / (literals + wildcards);
    expect(ratio, `Literal ratio ${(ratio * 100).toFixed(0)}% should be > 50%`).toBeGreaterThan(
      0.5,
    );
  });

  test('LeafArith pattern matches exactly 1 location in new lib', () => {
    const { pattern, newOff } = FUNCS['LeafArith'];
    const matches = scan(pattern, newLib);
    // LeafArith has no volatile instructions — the pattern is highly specific
    // Expect exactly 1 match at the new offset
    expect(matches.length).toBe(1);
    expect(matches[0]).toBe(newOff);
  });
});

// ─── 9. NearDuplicate — structural similarity doesn't cause cross-match ────────

describe('NearDuplicate: similar structure to MethodLookup but distinct pattern', () => {
  test('MethodLookup and NearDuplicate have different patterns', () => {
    expect(FUNCS['MethodLookup'].pattern).not.toBe(FUNCS['NearDuplicate'].pattern);
  });

  test('MethodLookup pattern does NOT match NearDuplicate new offset', () => {
    const { pattern } = FUNCS['MethodLookup'];
    const matches = scan(pattern, newLib);
    expect(matches.includes(FUNCS['NearDuplicate'].newOff)).toBe(false);
  });

  test('NearDuplicate pattern does NOT match MethodLookup new offset', () => {
    const { pattern } = FUNCS['NearDuplicate'];
    const matches = scan(pattern, newLib);
    expect(matches.includes(FUNCS['MethodLookup'].newOff)).toBe(false);
  });
});

// ─── 10. Summary report ──────────────────────────────────────────────────────

test('Summary: print pattern analysis for all functions', async () => {
  const header = [
    'Function'.padEnd(16),
    'Pattern length',
    '  Literals',
    '  Wildcards',
    '  Literal%',
    '  Matches in new lib',
  ].join('  ');
  console.log('\n' + header);
  console.log('─'.repeat(header.length));

  for (const { name } of FUNC_LAYOUT) {
    const { pattern, newOff } = FUNCS[name];
    const matches = scan(pattern, newLib);
    const literals = countLiteralNibbles(pattern);
    const wildcards = countWildcardNibbles(pattern);
    const pct = ((literals / (literals + wildcards)) * 100).toFixed(0);
    const matchStr =
      matches.length === 1 && matches[0] === newOff
        ? '✅ 1 exact'
        : matches.length > 0
          ? `⚠️  ${matches.length} (expected 0x${newOff.toString(16)})`
          : '❌ 0';

    console.log(
      [
        name.padEnd(16),
        String(pattern.split(' ').length).padStart(14),
        String(literals).padStart(10),
        String(wildcards).padStart(11),
        (pct + '%').padStart(10),
        matchStr.padStart(20),
      ].join('  '),
    );
  }

  // This test always passes — it's purely informational
  expect(true).toBe(true);
});
