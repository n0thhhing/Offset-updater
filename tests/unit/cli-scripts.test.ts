import { expect, test } from 'bun:test';
import { diffOffsets, parseOffsetLines, formatTerminalTable } from '../../scripts/diff-offsets';

test('parseOffsetLines parses single, sized, and multi-offset formats', () => {
  const content = `
-- Comments should be skipped
0x1000 -- SimpleMethod
0x2000|48 -- SizedMethod
0x3000 0x3100 -- AmbiguousMethod
`;
  const parsed = parseOffsetLines(content);
  expect(parsed.get('SimpleMethod')).toEqual([0x1000]);
  expect(parsed.get('SizedMethod')).toEqual([0x2000]);
  expect(parsed.get('AmbiguousMethod')).toEqual([0x3000, 0x3100]);
});

test('diffOffsets identifies matched, shifted, added, and removed methods', () => {
  const fileA = `
0x1000 -- StableMethod
0x2000 -- ShiftedMethod
0x3000 -- DeletedMethod
0x4000 -- MultiMethod
`;
  const fileB = `
0x1000 -- StableMethod
0x2500 -- ShiftedMethod
0x5000 -- AddedMethod
0x4000 0x4100 -- MultiMethod
`;
  const summary = diffOffsets(fileA, fileB);

  expect(summary.matched).toBe(1);
  expect(summary.shifted).toBe(1);
  expect(summary.added).toBe(1);
  expect(summary.removed).toBe(1);
  expect(summary.ambiguous).toBe(1);

  const shifted = summary.entries.find((e) => e.name === 'ShiftedMethod');
  expect(shifted).toBeDefined();
  expect(shifted!.status).toBe('shifted');
  expect(shifted!.delta).toBe(0x500);

  const formatted = formatTerminalTable(summary);
  expect(formatted).toContain('ShiftedMethod');
  expect(formatted).toContain('+0x500');
  expect(formatted).toContain('ADDED');
  expect(formatted).toContain('REMOV');
});

test('generateManifest correctly appends new methods without duplicates', async () => {
  const { generateManifest } = await import('../../scripts/generate-manifest');
  const fs = await import('node:fs');
  const tmpOut = `/tmp/test-manifest-unit-${Date.now()}.json`;

  try {
    // Generate initial 2 methods
    const m1 = await generateManifest({
      oldVersion: '23.4.2',
      newVersion: '23.4.3',
      count: 2,
      outputPath: tmpOut,
      log: () => {},
    });
    expect(m1.methods.length).toBe(2);

    // Append 2 more methods
    const m2 = await generateManifest({
      oldVersion: '23.4.2',
      newVersion: '23.4.3',
      count: 2,
      outputPath: tmpOut,
      append: true,
      log: () => {},
    });
    expect(m2.methods.length).toBe(4);

    // Verify all names are unique
    const names = m2.methods.map((m: any) => m.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(4);
  } finally {
    if (fs.existsSync(tmpOut)) {
      fs.unlinkSync(tmpOut);
    }
  }
});
