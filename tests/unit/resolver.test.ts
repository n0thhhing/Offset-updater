import { createDisassembler } from '../../src/disassembler';
import type { Disassembler, Instruction } from '../../src/disassembler';
import { afterAll, expect, test } from 'bun:test';
import { resolvePattern, scan } from '../../src';

const cs = createDisassembler();

afterAll(() => cs.close());

function sourceBytes() {
  const bytes = Buffer.alloc(1024);
  // Distinct stable ADD-immediate instructions, plus a register-relative load.
  for (let i = 0; i < 24; i++)
    bytes.writeUInt32LE((0x91000000 | ((i + 1) << 10) | (i % 16)) >>> 0, 64 + i * 4);
  bytes.writeUInt32LE(0xf94002a0, 80); // ldr x0, [x21]
  return bytes;
}
function branch(bytes: Buffer, offset: number, displacement: number) {
  bytes.writeUInt32LE((0x14000000 | ((displacement / 4) & 0x03ffffff)) >>> 0, offset);
}
function trampoline() {
  const source = sourceBytes(),
    destination = Buffer.alloc(1024);
  source.copy(destination, 128, 64, 160);
  branch(destination, 144, 384 - 144);
  source.copy(destination, 384, 80, 84);
  branch(destination, 388, 148 - 388);
  return { source, destination };
}

test('destination collisions extend a source-unique signature', async () => {
  const source = sourceBytes(),
    destination = Buffer.alloc(1024);
  source.copy(destination, 128, 64, 160);
  source.copy(destination, 256, 64, 112);
  const result = await resolvePattern(cs, source, destination, 64, 96);
  expect(result.strategy).toBe('extended');
  expect(result.length).toBe(60);
  expect(result.sourceMatches).toEqual([64]);
  expect(result.matches).toEqual([128]);
  expect(scan(result.pattern, destination)).toEqual([128]);
  const bounded = await resolvePattern(cs, source, destination, 64, 48);
  expect(bounded.length).toBe(48);
  expect(bounded.matches).toEqual([128, 256]);
});

test('stable small load offsets disambiguate portable-pattern collisions', async () => {
  const source = sourceBytes();
  const destination = Buffer.alloc(1024);
  source.copy(destination, 128, 64, 112);
  source.copy(destination, 256, 64, 112);
  destination.writeUInt32LE(0xf94006a0, 272); // ldr x0, [x21, #8] instead of [x21]

  const result = await resolvePattern(cs, source, destination, 64, 48);
  expect(result.strategy).toBe('extended');
  expect(result.sourceMatches).toEqual([64]);
  expect(result.matches).toEqual([128]);
  expect(scan(result.pattern, destination)).toEqual([128]);
});

test('multi-window matching survives one changed region and verifies control flow', async () => {
  const source = Buffer.alloc(1024);
  for (let i = 0; i < 48; i++) {
    source.writeUInt32LE(
      (0x91000000 | (((i + 1) & 0xfff) << 10) | ((i % 16) << 5) | (i % 16)) >>> 0,
      64 + i * 4,
    );
  }
  const destination = Buffer.alloc(1024);
  source.copy(destination, 400, 64, 256);
  destination.writeUInt32LE(0xd1000400, 400); // one ADD becomes SUB

  const result = await resolvePattern(cs, source, destination, 64, 192);
  expect(result.strategy).toBe('multi-window');
  expect(result.sourceMatches).toEqual([64]);
  expect(result.matches).toEqual([400]);
  expect(scan(result.pattern, destination)).toEqual([400]);
});

test('verified load trampoline yields a directly usable destination signature', async () => {
  const { source, destination } = trampoline();
  const result = await resolvePattern(cs, source, destination, 64, 96);
  expect(result.strategy).toBe('trampoline');
  expect(result.matches).toEqual([128]);
  expect(scan(result.pattern, destination)).toEqual([128]);
  expect(scan(result.sourcePattern, source)).toEqual([64]);
});

for (const failure of [
  'wrong-load',
  'wrong-return',
  'call',
  'outside-buffer',
  'second-change',
  'literal-load',
] as const) {
  test(`rejects unverified trampoline: ${failure}`, async () => {
    const { source, destination } = trampoline();
    if (failure === 'wrong-load') destination.writeUInt32LE(0xf94002a1, 384);
    if (failure === 'wrong-return') branch(destination, 388, 152 - 388);
    if (failure === 'call')
      destination.writeUInt32LE((destination.readUInt32LE(144) | 0x80000000) >>> 0, 144);
    if (failure === 'outside-buffer') branch(destination, 144, 4096);
    if (failure === 'second-change') destination.writeUInt32LE(0, 156);
    if (failure === 'literal-load') {
      source.writeUInt32LE(0x58000040, 80);
      destination.writeUInt32LE(0x58000040, 384);
    }
    expect((await resolvePattern(cs, source, destination, 64, 96)).matches).toEqual([]);
  });
}

test('two valid trampolines are not arbitrarily selected', async () => {
  const { source, destination } = trampoline();
  source.copy(destination, 512, 64, 160);
  branch(destination, 528, 768 - 528);
  source.copy(destination, 768, 80, 84);
  branch(destination, 772, 532 - 772);
  expect((await resolvePattern(cs, source, destination, 64, 96)).matches).toEqual([]);
});

test('ELF branch targets translate between executable segments', async () => {
  const source = sourceBytes(),
    destination = Buffer.alloc(1024);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1]).copy(destination);
  destination.writeBigUInt64LE(64n, 32);
  destination.writeUInt16LE(56, 54);
  destination.writeUInt16LE(2, 56);
  for (const [entry, file, va, size] of [
    [64, 256, 0x1000, 256],
    [120, 768, 0x9000, 256],
  ]) {
    destination.writeUInt32LE(1, entry);
    destination.writeUInt32LE(5, entry + 4);
    destination.writeBigUInt64LE(BigInt(file), entry + 8);
    destination.writeBigUInt64LE(BigInt(va), entry + 16);
    destination.writeBigUInt64LE(BigInt(size), entry + 32);
  }
  source.copy(destination, 320, 64, 160);
  branch(destination, 336, 0x9000 - 0x1050);
  source.copy(destination, 768, 80, 84);
  branch(destination, 772, 0x1054 - 0x9004);
  expect((await resolvePattern(cs, source, destination, 64, 96)).matches).toEqual([320]);
  destination.writeUInt32LE(4, 124); // The trampoline segment is no longer executable.
  expect((await resolvePattern(cs, source, destination, 64, 96)).matches).toEqual([]);
});
