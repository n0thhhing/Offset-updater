import { createDisassembler } from '../../src/disassembler';
import type { Disassembler } from '../../src/disassembler';
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { fixturePath } from '../../src/io/fixtures';
import { getPattern, readLib, scan } from '../../src';

let cs: Disassembler;
let oldLib: Buffer;
let newLib: Buffer;
let newHex: string;

const TARGETS = [
  'Player_GetHealth',
  'GameManager_GetInstance',
  'Weapon_Fire',
  'Object_IsInst',
  'ProcessEvent',
  'InvokeVirtualMethod',
  'ComputeHeavy',
  'GetPlayerDistance',
];
const oldOffsets: Record<string, { offset: number; size: number }> = {};
const newOffsets: Record<string, number> = {};

beforeAll(async () => {
  cs = createDisassembler();

  const fixtureDir = fixturePath('compiled');
  [oldLib, newLib] = await Promise.all([
    readLib(path.join(fixtureDir, 'old.so')),
    readLib(path.join(fixtureDir, 'new.so')),
  ]);
  newHex = newLib.toString('hex');

  // Parse offsets.txt for old lib offsets
  const offsetsTxt = fs.readFileSync(path.join(fixtureDir, 'offsets.txt'), 'utf-8');
  for (const line of offsetsTxt.split('\n')) {
    const match = line.match(/^0x([0-9a-fA-F]+)\|([0-9]+)\s*--\s*(.*)$/);
    if (match) {
      oldOffsets[match[3].trim()] = {
        offset: parseInt(match[1], 16),
        size: parseInt(match[2], 10),
      };
    }
  }

  // Run llvm-nm manually to get the exact new offsets for verification
  const { spawnSync } = await import('child_process');
  const res = spawnSync('llvm-nm', ['--dynamic', path.join(fixtureDir, 'new.so')], {
    encoding: 'utf-8',
  });
  for (const line of res.stdout.split('\n')) {
    const match = line.match(/^([0-9a-fA-F]+)\s+[A-Za-z]\s+(.*)$/);
    if (match) {
      newOffsets[match[2].trim()] = parseInt(match[1], 16);
    }
  }
});

afterAll(() => cs?.close?.());

describe('C Compiler Generated IL2CPP Library Tests', () => {
  for (const target of TARGETS) {
    test(`Pattern for ${target} correctly tracks shifted offset`, async () => {
      const oldInfo = oldOffsets[target];
      const newVA = newOffsets[target];

      expect(oldInfo).toBeDefined();
      expect(newVA).toBeDefined();

      // Translate Virtual Address to File Offset (subtracting ELF load bias 0x10000)
      const oldFileOff = oldInfo.offset - 0x10000;
      const newFileOff = newVA - 0x10000;

      // Generate pattern using the exact function size (capped at 120 bytes so we don't grab inline data pools)
      const sigLen = Math.min(oldInfo.size, 120);
      const pattern = await getPattern(cs, oldLib, oldFileOff, sigLen);

      const matches = scan(pattern, newHex);

      expect(matches.length).toBe(1);
      expect(matches[0]).toBe(newFileOff);
    });
  }
});
