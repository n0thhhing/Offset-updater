import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { updateOffsets } from '../../src/updater';
import type { UpdaterConfig } from '../../src/io/config';
import { parseSegments, vaToFile } from '../../src/binary/vtable';
import { createDisassembler } from '../../src/disassembler';
import obfuscated from '../manifests/23.5.2-to-23.7.0-obfuscated.json';
import { fixturePath } from '../../src/io/fixtures';

const projectRoot = path.resolve(import.meta.dir, '../..');
const source = fixturePath('real-game', '23.5.2', 'libil2cpp.so');
const destination = fixturePath('real-game', '23.7.0', 'libil2cpp.so');
const offsets = path.join(projectRoot, 'test_cli/offsets_23.5.2.txt');
const oldDump = fixturePath('real-game', '23.5.2', 'dump', 'script.json');
const newDump = fixturePath('real-game', '23.7.0', 'dump', 'script.json');
const requiredFixtures = [source, destination, offsets, oldDump, newDump];
const hasFixtures = requiredFixtures.every((file) => Bun.file(file).size > 0);
const expectedUnresolved = ['AppsMenu$$GetDeepLinkArgsFromiOS'];

if (!hasFixtures) {
  console.warn(
    'Skipping real-game stress test: the 23.5.2 and 23.7.0 binaries, dumps, and offset list are required.',
  );
}

describe.skipIf(!hasFixtures)('Pixel Gun 3D full-update stress test: 23.5.2 → 23.7.0', () => {
  let outputDirectory: string;

  beforeAll(async () => {
    outputDirectory = await mkdtemp(path.join(tmpdir(), 'offset-updater-stress-'));
  });

  afterAll(async () => {
    if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
  });

  test(
    'three complete 3,000+ method updates resolve every entry identically',
    async () => {
      let expectedOffsets: string | undefined;
      let expectedSignatures: string | undefined;
      let expectedTotal: number | undefined;
      const inputNames = (await readFile(offsets, 'utf8'))
        .trimEnd()
        .split('\n')
        .map((line) => line.slice(line.indexOf(' -- ') + 4));
      const inputEntries = (await readFile(offsets, 'utf8'))
        .trimEnd()
        .split('\n')
        .map((line) => {
          const [offset, name] = line.split(' -- ');
          return { offset: Number(offset), name };
        });
      type DumpMethod = { Name: string; Address: number; Signature: string };
      const oldMethods: DumpMethod[] = JSON.parse(await readFile(oldDump, 'utf8')).ScriptMethod;
      const newMethods: DumpMethod[] = JSON.parse(await readFile(newDump, 'utf8')).ScriptMethod;
      const [sourceBytes, destinationBytes] = await Promise.all([
        readFile(source),
        readFile(destination),
      ]);
      expect(createHash('sha256').update(sourceBytes).digest('hex')).toBe(
        obfuscated.builds['23.5.2'],
      );
      expect(createHash('sha256').update(destinationBytes).digest('hex')).toBe(
        obfuscated.builds['23.7.0'],
      );
      const destinationSegments = parseSegments(destinationBytes);
      const expectedByName = new Map<string, number>();
      for (const entry of inputEntries) {
        const oldIdentity = oldMethods.find(
          (method) => method.Name === entry.name && method.Address === entry.offset,
        );
        const namedCandidates = newMethods.filter((method) => method.Name === entry.name);
        const signatureCandidates = namedCandidates.filter(
          (method) => !oldIdentity || method.Signature === oldIdentity.Signature,
        );
        const candidates =
          signatureCandidates.length === 1
            ? signatureCandidates
            : namedCandidates.length === 1
              ? namedCandidates
              : [];
        if (candidates.length !== 1) continue;
        const expected = vaToFile(destinationSegments, BigInt(candidates[0].Address));
        if (expected !== null) expectedByName.set(entry.name, expected);
      }
      const disassembler = createDisassembler();
      try {
        for (const group of obfuscated.groups) {
          for (const [name, sourceOffset] of group.methods as [string, number][]) {
            const destinationOffset = sourceOffset + group.delta;
            expect(inputEntries.find((entry) => entry.name === name)?.offset, name).toBe(
              sourceOffset,
            );
            const sourceShape = disassembler
              .disasm(sourceBytes.subarray(sourceOffset, sourceOffset + 48), sourceOffset)
              .map((instruction) => instruction.mnemonic);
            const destinationShape = disassembler
              .disasm(
                destinationBytes.subarray(destinationOffset, destinationOffset + 48),
                destinationOffset,
              )
              .map((instruction) => instruction.mnemonic);
            expect(destinationShape, `${name}: instruction shape`).toEqual(sourceShape);
            expectedByName.set(name, destinationOffset);
          }
        }
      } finally {
        disassembler.close();
      }
      expect(expectedByName.size).toBe(inputEntries.length - expectedUnresolved.length);

      for (let iteration = 0; iteration < 3; iteration++) {
        const offsetOutput = path.join(outputDirectory, `offsets-${iteration}.txt`);
        const signatureOutput = path.join(outputDirectory, `signatures-${iteration}.txt`);
        const config: UpdaterConfig = {
          oldLibrary: source,
          newLibrary: destination,
          offsets,
          offsetOutput,
          signatureOutput,
          signatureLength: 2000,
          oldDump,
          newDump,
          xrefResolution: true,
        };

        const progress = process.env.OFFSET_UPDATER_PROGRESS === '1' ? console.log : undefined;
        const result = await updateOffsets(config, progress);
        const [actualOffsets, actualSignatures] = await Promise.all([
          readFile(offsetOutput, 'utf8'),
          readFile(signatureOutput, 'utf8'),
        ]);

        expect(result.total).toBeGreaterThan(3000);
        expect(result.resolved).toBe(result.total - expectedUnresolved.length);
        const resolvedNames = new Set(
          actualOffsets
            .trimEnd()
            .split('\n')
            .map((line) => line.slice(line.indexOf(' -- ') + 4)),
        );
        expect(inputNames.filter((name) => !resolvedNames.has(name))).toEqual(expectedUnresolved);
        expect(actualOffsets.trimEnd().split('\n')).toHaveLength(result.resolved);
        expect(actualSignatures.trimEnd().split('\n')).toHaveLength(result.resolved);
        const actualByName = new Map(
          actualOffsets
            .trimEnd()
            .split('\n')
            .map((line) => {
              const [offset, name] = line.split(' -- ');
              return [name, Number(offset)] as const;
            }),
        );
        for (const [name, expectedOffset] of expectedByName) {
          expect(actualByName.get(name), name).toBe(expectedOffset);
        }
        const directPatternCount = actualSignatures
          .trimEnd()
          .split('\n')
          .filter(
            (line) =>
              !line.startsWith('rodata-resolved -- ') &&
              !line.startsWith('vtable-xref-resolved -- ') &&
              !line.startsWith('fallback -- '),
          ).length;
        expect(directPatternCount).toBeGreaterThan(2940);

        if (iteration === 0) {
          expectedTotal = result.total;
          expectedOffsets = actualOffsets;
          expectedSignatures = actualSignatures;
        } else {
          expect(result.total).toBe(expectedTotal!);
          expect(actualOffsets).toBe(expectedOffsets!);
          expect(actualSignatures).toBe(expectedSignatures!);
        }
      }
    },
    10 * 60_000,
  );
});
