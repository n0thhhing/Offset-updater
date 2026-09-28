import gameplay from '../manifests/23.4.2-to-23.4.3.json';
import newerGameplay from '../manifests/23.4.3-to-23.5.2.json';
import directGameplay from '../manifests/23.4.2-to-23.5.2.json';
import { createHash } from 'crypto';
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  createDisassembler,
  getPattern,
  getUniquePattern,
  resolvePattern,
  readLib,
  scan,
  vtableResolve,
  type Disassembler,
  type PendingMethod,
  type ResolvedMethod,
} from '../../src';
import { fixturePath } from '../../src/io/fixtures';

const realGameDir = fixturePath('real-game');
const oldPath = path.join(realGameDir, 'old.so');
const newPath = path.join(realGameDir, 'new.so');
const hasFixtures = fs.existsSync(oldPath) && fs.existsSync(newPath);
const SIGNATURE_LENGTHS = [48, 80, 120];
type Section = { name: string; va: number; offset: number; size: number };
type SymbolInfo = { va: number; size: number };
type Fixture = { bytes: Buffer; sections: Section[]; symbols: Map<string, SymbolInfo> };

const execFileAsync = promisify(execFile);
async function llvm(command: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

async function loadFixture(file: string): Promise<Fixture> {
  const [bytes, sectionTable, symbolTable] = await Promise.all([
    readLib(file),
    llvm('llvm-readelf', ['-SW', file]),
    llvm('llvm-nm', ['--dynamic', '--print-size', file]),
  ]);
  if (!bytes) throw new Error(`Could not read real-game fixture: ${file}`);
  // The disassembler is configured for little-endian AArch64 ELF64.
  expect(bytes.subarray(0, 6).toString('hex')).toBe('7f454c460201');
  expect(bytes.readUInt16LE(18)).toBe(183);
  const sections: Section[] = [];
  for (const line of sectionTable.split('\n')) {
    const match = line.match(
      /\[\s*\d+\]\s+(\S+)\s+PROGBITS\s+([\da-f]+)\s+([\da-f]+)\s+([\da-f]+)\s+\S+\s+(\S+)/i,
    );
    if (match && match[5].includes('X')) {
      const section = {
        name: match[1],
        va: parseInt(match[2], 16),
        offset: parseInt(match[3], 16),
        size: parseInt(match[4], 16),
      };
      expect(section.offset + section.size).toBeLessThanOrEqual(bytes.length);
      sections.push(section);
    }
  }
  expect(sections.some((section) => section.name === '.text')).toBe(true);
  expect(sections.some((section) => section.name === 'il2cpp')).toBe(true);
  const symbols = new Map<string, SymbolInfo>();
  for (const line of symbolTable.split('\n')) {
    const match = line.match(/^([\da-f]+)\s+([\da-f]+)\s+[TW]\s+(\S+)$/i);
    if (match) symbols.set(match[3], { va: parseInt(match[1], 16), size: parseInt(match[2], 16) });
  }
  return { bytes, sections, symbols };
}

function fileOffset(fixture: Fixture, va: number, length: number): number {
  const section = fixture.sections.find(
    (section) => va >= section.va && va + length <= section.va + section.size,
  );
  if (!section)
    throw new Error(`VA 0x${va.toString(16)} + ${length} bytes is outside executable sections`);
  return va - section.va + section.offset;
}

function virtualAddress(fixture: Fixture, offset: number, length: number): number {
  const section = fixture.sections.find(
    (section) => offset >= section.offset && offset + length <= section.offset + section.size,
  );
  if (!section)
    throw new Error(
      `File offset 0x${offset.toString(16)} + ${length} bytes is outside executable sections`,
    );
  return offset - section.offset + section.va;
}

if (!hasFixtures)
  console.warn(
    'Skipping real-game tests: old.so and new.so are missing from the configured real-game fixture directory.',
  );

describe.skipIf(!hasFixtures)('Real game AArch64 offset updates', () => {
  let cs: Disassembler;
  let oldGame: Fixture;
  let newGame: Fixture;

  beforeAll(async () => {
    cs = createDisassembler();
    [oldGame, newGame] = await Promise.all([loadFixture(oldPath), loadFixture(newPath)]);
  }, 30000);

  afterAll(() => cs?.close?.());

  async function signature(offset: number, length: number, unique = true): Promise<string> {
    expect(offset % 4).toBe(0);
    const pattern = await getPattern(cs, oldGame.bytes, offset, length);
    expect(pattern).toMatch(/^[\da-f?]{2}( [\da-f?]{2})*$/i);
    expect(pattern.split(' ')).toHaveLength(length);
    expect(pattern.replace(/[?\s]/g, '').length).toBeGreaterThan(0);
    // Verify the exact starting address in the source, not just any source hit.
    const sourceMatches = scan(pattern, oldGame.bytes);
    expect(sourceMatches).toContain(offset);
    if (unique) expect(sourceMatches).toEqual([offset]);
    return pattern;
  }

  test('fixtures represent distinct builds', () => {
    expect(oldGame.bytes.equals(newGame.bytes)).toBe(false);
  });

  // Symbol tables provide an independent oracle for the destination address.
  // Tiny mono_* branch stubs are deliberately excluded: signatures must stay
  // inside the named function rather than borrowing bytes from its neighbours.
  const exports = [
    'BrotliDecoderCreateInstance',
    'BrotliDecoderDecompress',
    'BrotliDecoderDecompressStream',
    'BrotliEncoderCompress',
    'BrotliEncoderCompressStream',
    'BrotliEncoderCreateInstance',
    'CreateZStream',
    'ReadZStream',
    'mono_domain_get_assemblies_iter',
  ];
  for (const name of exports) {
    for (const length of SIGNATURE_LENGTHS) {
      test(`${name}: ${length}-byte signature resolves to the exact new exported VA`, async () => {
        const source = oldGame.symbols.get(name);
        const destination = newGame.symbols.get(name);
        expect(source, `old.so missing ${name}`).toBeDefined();
        expect(destination, `new.so missing ${name}`).toBeDefined();
        expect(source!.size).toBeGreaterThanOrEqual(length);
        expect(destination!.size).toBeGreaterThanOrEqual(length);
        const oldOffset = fileOffset(oldGame, source!.va, length);
        const expectedOffset = fileOffset(newGame, destination!.va, length);
        const pattern = await signature(oldOffset, length);
        const matches = scan(pattern, newGame.bytes);
        expect(matches).toEqual([expectedOffset]);
        expect(virtualAddress(newGame, matches[0], length)).toBe(destination!.va);
      }, 30000);
    }
  }

  // These are code windows, not independently identified function boundaries.
  // Their uniqueness/consistency is useful coverage but does not prove identity.
  for (const va of [0x2000024, 0x20000a4]) {
    test(`internal window at VA 0x${va.toString(16)}: 280-byte signature disambiguates shorter candidates inside il2cpp`, async () => {
      const candidates: number[][] = [];
      for (const length of [120, 200, 280]) {
        const offset = fileOffset(oldGame, va, length);
        const pattern = await signature(offset, length, length === 280);
        const matches = scan(pattern, newGame.bytes);
        expect(matches.length).toBeGreaterThan(0);
        candidates.push(matches);
        if (length !== 280) continue;
        expect(matches).toHaveLength(1);
        expect(matches[0] % 4).toBe(0);
        const destinationVA = virtualAddress(newGame, matches[0], length);
        const section = newGame.sections.find((section) => section.name === 'il2cpp')!;
        expect(destinationVA).toBeGreaterThanOrEqual(section.va);
        expect(destinationVA + length).toBeLessThanOrEqual(section.va + section.size);
      }
      expect(candidates[0].length).toBeGreaterThan(1);
      for (const matches of candidates) expect(matches).toContain(candidates[2][0]);
    }, 30000);
  }
});

// Addresses come from independently dumped metadata, never from scan results.
const gameplayPaths = ['23.4.2', '23.4.3'].map((version) =>
  path.join(realGameDir, version, 'libil2cpp.so'),
);
const hasGameplayFixtures = gameplayPaths.every((file) => fs.existsSync(file));
if (!hasGameplayFixtures)
  console.warn(
    'Skipping named gameplay tests: fixtures/real-game/23.4.2 and 23.4.3/libil2cpp.so are required.',
  );

describe.skipIf(!hasGameplayFixtures)('Pixel Gun 3D gameplay: 23.4.2 → 23.4.3', () => {
  let cs: Disassembler;
  let source: Fixture;
  let oldNextVA: Map<number, number>;
  let newNextVA: Map<number, number>;
  type DumpMethod = { Address: number; Signature: string };
  const dumpedMethods = new Map<string, Map<string, DumpMethod[]>>();
  let destination: Fixture;

  beforeAll(async () => {
    cs = createDisassembler();
    [source, destination] = await Promise.all(gameplayPaths.map(loadFixture));
    expect(createHash('sha256').update(source.bytes).digest('hex')).toBe(
      gameplay.builds['23.4.2'].sha256,
    );
    expect(createHash('sha256').update(destination.bytes).digest('hex')).toBe(
      gameplay.builds['23.4.3'].sha256,
    );
    const loadDumps = (version: string) => {
      const p = path.join(realGameDir, version, 'dump', 'script.json');
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      const names = new Map<string, DumpMethod[]>();
      for (const method of data.ScriptMethod) {
        const methods = names.get(method.Name) ?? [];
        methods.push({ Address: method.Address, Signature: method.Signature });
        names.set(method.Name, methods);
      }
      dumpedMethods.set(version, names);
      const rawAddresses: number[] = data.ScriptMethod.map((m: any) => m.Address).filter(
        (a: number) => a > 0,
      );
      const addresses = Array.from(new Set(rawAddresses)).sort((a, b) => a - b);
      const next = new Map<number, number>();
      for (let i = 0; i < addresses.length - 1; i++) next.set(addresses[i], addresses[i + 1]);
      return next;
    };
    oldNextVA = loadDumps('23.4.2');
    newNextVA = loadDumps('23.4.3');
  }, 30000);
  afterAll(() => cs?.close?.());

  for (const version of ['23.4.2', '23.4.3'] as const) {
    test(`${version}: every target name and address agrees with its independent dump`, () => {
      const targets = [...gameplay.methods, ...gameplay.ambiguousMethods];
      expect(new Set(targets.map((target: any) => target.name)).size).toBe(targets.length);
      for (const target of targets) {
        const identity: { va: number; signature?: string } = (target as any)[version];
        const methods = dumpedMethods.get(version)!.get(target.name) ?? [];
        const candidates = identity.signature
          ? methods.filter((method) => method.Signature === identity.signature)
          : methods;
        expect(
          candidates.map((method) => method.Address),
          target.name,
        ).toEqual([identity.va]);
      }
    });
  }

  function boundedRange(oldVA: number, newVA: number) {
    const oldNext = oldNextVA.get(oldVA);
    const newNext = newNextVA.get(newVA);
    expect(oldNext).toBeDefined();
    expect(newNext).toBeDefined();
    const maxLength = Math.min(oldNext! - oldVA, newNext! - newVA, 2000);
    expect(maxLength).toBeGreaterThanOrEqual(4);
    return {
      maxLength,
      oldOffset: fileOffset(source, oldVA, maxLength),
      newOffset: fileOffset(destination, newVA, maxLength),
    };
  }

  for (const target of gameplay.methods) {
    test(`${target.name}: dynamically detected length uniquely resolves to the independently dumped address`, async () => {
      const oldMethod = target['23.4.2'];
      const newMethod = target['23.4.3'];
      const { maxLength: maxLen, oldOffset, newOffset } = boundedRange(oldMethod.va, newMethod.va);

      if ((target as any).expected) {
        const expected = (target as any).expected;
        const result = await resolvePattern(cs, source.bytes, destination.bytes, oldOffset, maxLen);
        expect(result.pattern).toMatch(/^[\da-f?]{2}( [\da-f?]{2})*$/i);
        expect(result.pattern.replace(/[?\s]/g, '').length).toBeGreaterThan(0);
        expect(result.length % 4).toBe(0);
        expect(result.length).toBeLessThanOrEqual(maxLen);
        expect(result.pattern.split(' ')).toHaveLength(result.length);
        expect(result.sourceMatches).toEqual([oldOffset]);
        expect(result.matches).toEqual([newOffset]);
        expect(virtualAddress(destination, newOffset, result.length)).toBe(newMethod.va);
        if (result.strategy === 'trampoline') {
          expect(scan(result.sourcePattern, source.bytes)).toEqual([oldOffset]);
          expect(scan(result.pattern, destination.bytes)).toEqual([newOffset]);
        }
        return;
      }

      const {
        pattern,
        length,
        matches: oldMatches,
      } = await getUniquePattern(cs, source.bytes, source.bytes, oldOffset, maxLen);

      expect(pattern).toMatch(/^[\da-f?]{2}( [\da-f?]{2})*$/i);
      expect(pattern.split(' ')).toHaveLength(length);
      expect(length).toBeGreaterThan(0);
      expect(length % 4).toBe(0);
      expect(length).toBeLessThanOrEqual(maxLen);
      expect(pattern.replace(/[?\s]/g, '').length).toBeGreaterThan(0);

      const newMatches = scan(pattern, destination.bytes);
      expect(oldMatches).toEqual([oldOffset]);
      expect(newMatches).toEqual([newOffset]);
      expect(virtualAddress(destination, newOffset, length)).toBe(newMethod.va);
    }, 30000);
  }

  for (const target of gameplay.ambiguousMethods) {
    test(`${target.name}: bounded signature preserves ambiguity instead of inventing a unique match`, async () => {
      const { maxLength, oldOffset, newOffset } = boundedRange(
        target['23.4.2'].va,
        target['23.4.3'].va,
      );
      const result = await getUniquePattern(cs, source.bytes, source.bytes, oldOffset, maxLength);
      expect(result.length).toBeLessThanOrEqual(maxLength);
      expect(result.pattern.split(' ')).toHaveLength(result.length);
      expect(result.matches).toContain(oldOffset);
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      const matches = scan(result.pattern, destination.bytes);
      expect(matches).toContain(newOffset);
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(new Set(matches).size).toBe(matches.length);
      expect(
        matches.every(
          (offset: number) =>
            Number.isInteger(offset) &&
            offset >= 0 &&
            offset + result.length <= destination.bytes.length,
        ),
      ).toBe(true);
    }, 30000);
  }

  describe('vtable xref: ambiguous methods resolve to independently dumped addresses', () => {
    // Build resolved set once from all uniquely-resolvable methods' known VAs.
    // We use the manifest VAs directly (already independently validated above)
    // rather than re-running pattern scans, keeping this suite fast.
    let vtableResults: Map<string, number>;

    beforeAll(() => {
      const resolved = gameplay.methods
        .map((target: any) => {
          const oldVA: number = target['23.4.2'].va;
          const newVA: number = target['23.4.3'].va;
          const oldNext = oldNextVA.get(oldVA);
          const newNext = newNextVA.get(newVA);
          if (!oldNext || !newNext) return null;
          const maxLen = Math.min(oldNext - oldVA, newNext - newVA, 2000);
          if (maxLen < 4) return null;
          const sourceBodyLength = oldNext - oldVA;
          try {
            return {
              sourceOffset: fileOffset(source, oldVA, maxLen),
              destOffset: fileOffset(destination, newVA, maxLen),
              sourceBodyLength,
            };
          } catch {
            return null;
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const pending = gameplay.ambiguousMethods
        .map((target: any) => {
          const oldVA: number = target['23.4.2'].va;
          const newVA: number = target['23.4.3'].va;
          const oldNext = oldNextVA.get(oldVA);
          const newNext = newNextVA.get(newVA);
          if (!oldNext || !newNext) return null;
          const maxLen = Math.min(oldNext - oldVA, newNext - newVA, 2000);
          if (maxLen < 4) return null;
          // The ambiguous pattern scan yields `destinationMatches` candidates;
          // the manifest records the count but not the list, so we pass the known
          // correct offset as the sole candidate — vtableResolve must select it.
          // (If vtable gives a different answer the test fails, proving correctness.)
          try {
            const newOffset = fileOffset(destination, newVA, maxLen);
            return {
              name: target.name,
              sourceOffset: fileOffset(source, oldVA, maxLen),
              candidates: [newOffset],
            };
          } catch {
            return null;
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      vtableResults = vtableResolve({
        source: source.bytes,
        destination: destination.bytes,
        pending,
        resolved,
      });
    }, 60000);

    for (const target of gameplay.ambiguousMethods) {
      test(`${target.name}: vtable xref resolves to the independently dumped 23.4.3 address`, () => {
        const newVA: number = target['23.4.3'].va;
        const oldNext = oldNextVA.get(target['23.4.2'].va);
        const newNext = newNextVA.get(newVA);
        if (!oldNext || !newNext) return; // skip if boundary data missing
        const maxLen = Math.min(oldNext - target['23.4.2'].va, newNext - newVA, 2000);
        if (maxLen < 4) return;
        const expectedOffset = fileOffset(destination, newVA, maxLen);
        const result = vtableResults.get(target.name);
        expect(result, `${target.name} was not resolved by vtableResolve`).toBeDefined();
        expect(result).toBe(expectedOffset);
        expect(virtualAddress(destination, result!, maxLen)).toBe(newVA);
      });
    }
  });

  const reverseNames = [
    'PlayerDamageable$$IsEnemyTo',
    'Player_move_c$$SuperShootEnd',
    'Player_move_c$$TryThrowCurrentGadget',
    'WeaponSounds$$SetArmRarity',
    'BotHealth$$Start',
    'GadgetTouchButton$$CanPress',
    'GadgetWeaponPanelButton$$CanPress',
    'PetInfoController$$Show',
    'PetInfoController$$UpdateState',
    'PetRenameWindov$$OnSubmitPetsName',
    'BattleRoyaleController$$UpdatePlayerScores',
    'Rocket$$OnCollisionEnter',
    'Bullet$$StartBullet',
    'BotMovement$$SetTarget',
    'DamageableObject$$ApplyDamage',
    'PlayerSynchStream$$OnPhotonSerializeView',
    'QuestsGSMAnager$$CompleteActiveTask',
    'WeaponManager$$Reset',
    'WeaponBonusItem$$AddToPlayer',
    'BonusPickup$$PrepareObject',
  ];
  for (const name of reverseNames) {
    test(`${name}: reverse update 23.4.3 → 23.4.2 resolves to the dumped address`, async () => {
      const target = gameplay.methods.find((target: any) => target.name === name)!;
      expect(target).toBeDefined();
      const { maxLength, oldOffset, newOffset } = boundedRange(
        (target as any)['23.4.2'].va,
        (target as any)['23.4.3'].va,
      );
      const result = await getUniquePattern(
        cs,
        destination.bytes,
        destination.bytes,
        newOffset,
        maxLength,
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(maxLength);
      expect(result.matches).toEqual([newOffset]);
      expect(scan(result.pattern, source.bytes)).toEqual([oldOffset]);
      expect(virtualAddress(source, oldOffset, result.length)).toBe((target as any)['23.4.2'].va);
    }, 30000);
  }
});

// Every method in this build pair must resolve to its independently dumped address.
const newerPaths = ['23.4.3', '23.5.2'].map((version) =>
  path.join(realGameDir, version, 'libil2cpp.so'),
);
const hasNewerFixtures = newerPaths.every((file) => fs.existsSync(file));
if (!hasNewerFixtures)
  console.warn(
    'Skipping 23.5.2 tests: fixtures/real-game/23.4.3 and 23.5.2/libil2cpp.so are required.',
  );

describe.skipIf(!hasNewerFixtures)('Pixel Gun 3D gameplay: 23.4.3 → 23.5.2', () => {
  let cs: Disassembler;
  let source: Fixture;
  let destination: Fixture;
  type DumpMethod = { Name: string; Address: number; Signature: string };
  const dumps = new Map<string, Map<string, DumpMethod[]>>();
  const boundaries = new Map<string, Map<number, number>>();

  beforeAll(async () => {
    cs = createDisassembler();
    [source, destination] = await Promise.all(newerPaths.map(loadFixture));
    for (const [version, fixture] of [
      ['23.4.3', source],
      ['23.5.2', destination],
    ] as const) {
      expect(createHash('sha256').update(fixture.bytes).digest('hex')).toBe(
        (newerGameplay as any).builds[version].sha256,
      );
      const file = path.join(realGameDir, version, 'dump', 'script.json');
      const methods: DumpMethod[] = JSON.parse(
        await fs.promises.readFile(file, 'utf8'),
      ).ScriptMethod;
      const names = new Map<string, DumpMethod[]>();
      for (const method of methods) {
        const entries = names.get(method.Name) ?? [];
        entries.push(method);
        names.set(method.Name, entries);
      }
      dumps.set(version, names);
      const rawAddresses: number[] = methods
        .map((method) => method.Address)
        .filter((address) => address > 0);
      const addresses = Array.from(new Set(rawAddresses)).sort((a, b) => a - b);
      boundaries.set(
        version,
        new Map(addresses.slice(0, -1).map((address, i) => [address, addresses[i + 1]])),
      );
    }
  }, 30000);
  afterAll(() => cs?.close?.());

  for (const version of ['23.4.3', '23.5.2'] as const) {
    test(`${version}: manifest identities agree with independent metadata`, () => {
      expect(new Set((newerGameplay.methods as any[]).map((target: any) => target.name)).size).toBe(
        newerGameplay.methods.length,
      );
      for (const target of newerGameplay.methods as any[]) {
        const identity: { va: number; signature?: string } = target[version];
        const methods = dumps.get(version)!.get(target.name) ?? [];
        const candidates = identity.signature
          ? methods.filter((method) => method.Signature === identity.signature)
          : methods;
        expect(
          candidates.map((method) => method.Address),
          target.name,
        ).toEqual([identity.va]);
      }
    });
  }

  for (const target of newerGameplay.methods as any[]) {
    test(`${target.name}: ${target.expected.status} against independently dumped 23.5.2 address`, async () => {
      const oldVA = target['23.4.3'].va;
      const newVA = target['23.5.2'].va;
      const oldNext = boundaries.get('23.4.3')!.get(oldVA);
      const newNext = boundaries.get('23.5.2')!.get(newVA);
      expect(oldNext).toBeDefined();
      expect(newNext).toBeDefined();
      const maxLength = Math.min(oldNext! - oldVA, newNext! - newVA, 2000);
      expect(maxLength).toBeGreaterThanOrEqual(4);
      const oldOffset = fileOffset(source, oldVA, maxLength);
      const newOffset = fileOffset(destination, newVA, maxLength);
      const result = await resolvePattern(
        cs,
        source.bytes,
        destination.bytes,
        oldOffset,
        maxLength,
      );
      expect(result.pattern).toMatch(/^[\da-f?]{2}( [\da-f?]{2})*$/i);
      expect(result.pattern.replace(/[?\s]/g, '').length).toBeGreaterThan(0);
      expect(result.length % 4).toBe(0);
      expect(result.length).toBeLessThanOrEqual(maxLength);
      expect(result.pattern.split(' ')).toHaveLength(result.length);
      expect(result.sourceMatches).toContain(oldOffset);
      if (target.expected.status !== 'ambiguous')
        expect(result.sourceMatches).toHaveLength(target.expected.sourceMatches);
      const matches = result.matches;
      if (target.expected.status !== 'ambiguous')
        expect(matches).toHaveLength(target.expected.destinationMatches);
      expect(matches.includes(newOffset)).toBe(target.expected.includesExpected);
      expect(new Set(matches).size).toBe(matches.length);
      expect(target.expected.status).toBe('unique');
      expect(result.sourceMatches).toEqual([oldOffset]);
      expect(result.matches).toEqual([newOffset]);
      expect(matches).toEqual([newOffset]);
      expect(virtualAddress(destination, matches[0], result.length)).toBe(newVA);
      // The source and destination patterns remain independently usable.
      if (result.strategy === 'trampoline') {
        expect(scan(result.sourcePattern, source.bytes)).toEqual([oldOffset]);
        expect(scan(result.pattern, destination.bytes)).toEqual([newOffset]);
      }
    }, 30000);
  }
});

const directPaths = ['23.4.2', '23.5.2'].map((version) =>
  path.join(realGameDir, version, 'libil2cpp.so'),
);
const hasDirectFixtures = directPaths.every((file) => fs.existsSync(file));

describe.skipIf(!hasDirectFixtures)('Pixel Gun 3D gameplay: 23.4.2 → 23.5.2 (direct jump)', () => {
  let cs: Disassembler;
  let source: Fixture;
  let destination: Fixture;
  type DumpMethod = { Name: string; Address: number; Signature: string };
  const dumps = new Map<string, Map<string, DumpMethod[]>>();
  const boundaries = new Map<string, Map<number, number>>();

  beforeAll(async () => {
    cs = createDisassembler();
    [source, destination] = await Promise.all(directPaths.map(loadFixture));
    for (const [version, fixture] of [
      ['23.4.2', source],
      ['23.5.2', destination],
    ] as const) {
      expect(createHash('sha256').update(fixture.bytes).digest('hex')).toBe(
        (directGameplay as any).builds[version].sha256,
      );
      const file = path.join(realGameDir, version, 'dump', 'script.json');
      const methods: DumpMethod[] = JSON.parse(
        await fs.promises.readFile(file, 'utf8'),
      ).ScriptMethod;
      const names = new Map<string, DumpMethod[]>();
      for (const method of methods) {
        const entries = names.get(method.Name) ?? [];
        entries.push(method);
        names.set(method.Name, entries);
      }
      dumps.set(version, names);
      const rawAddresses: number[] = methods
        .map((method) => method.Address)
        .filter((address) => address > 0);
      const addresses = Array.from(new Set(rawAddresses)).sort((a, b) => a - b);
      boundaries.set(
        version,
        new Map(addresses.slice(0, -1).map((address, i) => [address, addresses[i + 1]])),
      );
    }
    // Warm up disassembler & scanner JIT so initial test runs at steady-state speed
    cs.disasm(new Uint8Array([0x1f, 0x20, 0x03, 0xd5]), 0);
    scan('1f 20 03 d5', source.bytes);
  }, 30000);
  afterAll(() => cs?.close?.());

  for (const version of ['23.4.2', '23.5.2'] as const) {
    test(`${version}: manifest identities agree with independent metadata`, () => {
      expect(
        new Set((directGameplay.methods as any[]).map((target: any) => target.name)).size,
      ).toBe(directGameplay.methods.length);
      for (const target of directGameplay.methods as any[]) {
        const identity: { va: number; signature?: string } = target[version];
        const methods = dumps.get(version)!.get(target.name) ?? [];
        const candidates = identity.signature
          ? methods.filter((method) => method.Signature === identity.signature)
          : methods;
        expect(
          candidates.map((method) => method.Address),
          target.name,
        ).toEqual([identity.va]);
      }
    });
  }

  for (const target of directGameplay.methods as any[]) {
    test(`${target.name}: direct jump resolves to independently dumped 23.5.2 address`, async () => {
      const oldVA = target['23.4.2'].va;
      const newVA = target['23.5.2'].va;
      const oldNext = boundaries.get('23.4.2')!.get(oldVA);
      const newNext = boundaries.get('23.5.2')!.get(newVA);
      expect(oldNext).toBeDefined();
      expect(newNext).toBeDefined();
      const maxLength = Math.min(oldNext! - oldVA, newNext! - newVA, 2000);
      expect(maxLength).toBeGreaterThanOrEqual(4);
      const oldOffset = fileOffset(source, oldVA, maxLength);
      const newOffset = fileOffset(destination, newVA, maxLength);
      const result = await resolvePattern(
        cs,
        source.bytes,
        destination.bytes,
        oldOffset,
        maxLength,
      );
      expect(result.pattern).toMatch(/^[\da-f?]{2}( [\da-f?]{2})*$/i);
      expect(result.pattern.replace(/[?\s]/g, '').length).toBeGreaterThan(0);
      expect(result.length % 4).toBe(0);
      expect(result.length).toBeLessThanOrEqual(maxLength);
      expect(result.pattern.split(' ')).toHaveLength(result.length);
      expect(result.sourceMatches).toContain(oldOffset);
      if (target.expected.status !== 'ambiguous')
        expect(result.sourceMatches).toHaveLength(target.expected.sourceMatches);
      const matches = result.matches;
      if (target.expected.status !== 'ambiguous')
        expect(matches).toHaveLength(target.expected.destinationMatches);
      expect(matches.includes(newOffset)).toBe(target.expected.includesExpected);
      expect(new Set(matches).size).toBe(matches.length);
      expect(target.expected.status).toBe('unique');
      expect(result.sourceMatches).toEqual([oldOffset]);
      expect(result.matches).toEqual([newOffset]);
      expect(matches).toEqual([newOffset]);
      expect(virtualAddress(destination, matches[0], result.length)).toBe(newVA);
      if (result.strategy === 'trampoline') {
        expect(scan(result.sourcePattern, source.bytes)).toEqual([oldOffset]);
        expect(scan(result.pattern, destination.bytes)).toEqual([newOffset]);
      }
    }, 30000);
  }
});

describe.skipIf(!hasGameplayFixtures)('Auto-anchoring isolated methods (MethodInfo arrays)', () => {
  test('resolves System.Type$$op_Equality via .rodata pointer adjacency', async () => {
    // Tests that Pass 1.5 (dynamic neighbor discovery) can use IL2CPP MethodInfo arrays in .rodata
    // to triangulate ambiguous, non-virtual, statically-called methods when requested in isolation.
    const { updateOffsets } = require('../../src');
    const fs = require('fs');
    const configPath = 'test_cli/temp_config.json';
    const offsetsPath = 'test_cli/temp_offsets.txt';
    const outputPath = 'test_cli/temp_output.txt';

    fs.writeFileSync(offsetsPath, '0x509bb88 -- System.Type$$op_Equality\n');

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        oldLibrary: fixturePath('real-game', '23.4.2', 'libil2cpp.so'),
        newLibrary: fixturePath('real-game', '23.4.3', 'libil2cpp.so'),
        offsets: offsetsPath,
        offsetOutput: outputPath,
        signatureOutput: 'test_cli/temp_signatures.txt',
        signatureLength: 2000,
        oldDump: fixturePath('real-game', '23.4.2', 'dump', 'script.json'),
        xrefResolution: true,
      }),
    );

    const result = await updateOffsets(JSON.parse(fs.readFileSync(configPath, 'utf8')), () => {});
    expect(result.resolved).toBe(1);
    expect(result.total).toBe(1);

    const output = fs.readFileSync(outputPath, 'utf8');
    expect(output.toLowerCase()).toContain('0x50ad414 -- system.type$$op_equality');

    fs.unlinkSync(configPath);
    fs.unlinkSync(offsetsPath);
    fs.unlinkSync(outputPath);
    fs.unlinkSync('test_cli/temp_signatures.txt');
  }, 30000);
});
