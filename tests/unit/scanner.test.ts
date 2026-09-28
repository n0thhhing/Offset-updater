import type { Disassembler, Instruction } from '../../src/disassembler';
import { expect, test } from 'bun:test';
import { scan } from '../../src/patterns/scan';
import { getUniquePattern } from '../../src/patterns/signature';

function reference(pattern: string, data: Uint8Array) {
  const parts = pattern.replace(/\s/g, '').match(/../g) ?? [];
  if (!parts.length) return [];
  const result: number[] = [];
  for (let i = 0; i <= data.length - parts.length; i++) {
    if (
      parts.every((p, j) => {
        const hex = data[i + j].toString(16).padStart(2, '0');
        return [...p].every((n, k) => n === '?' || n.toLowerCase() === hex[k]);
      })
    )
      result.push(i);
  }
  return result;
}

test('native and fallback scans match an independent oracle at boundaries', () => {
  let seed = 42;
  const data = Buffer.from(
    Array.from({ length: 2048 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed >>> 24;
    }),
  );
  for (const size of [2, 9, 129, 1024, 2048]) {
    const bytes = data.subarray(0, size);
    for (const pos of [0, Math.floor(size / 8), size - 2]) {
      const hex = bytes.subarray(pos, pos + 2).toString('hex');
      for (const pattern of [hex, `?? ${hex.slice(2)}`, `${hex[0]}? ?${hex[3]}`, '?? ??']) {
        expect(scan(pattern, bytes)).toEqual(reference(pattern, bytes));
      }
    }
  }
  expect(scan('?? ab', Buffer.from([0xab, 0xab]))).toEqual([0]);
  expect(scan('', data)).toEqual([]);
  expect(scan('ab cd', Buffer.alloc(0))).toEqual([]);
});

test('all matches survive native output overflow and long patterns use fallback', () => {
  expect(scan('ab ab', Buffer.alloc(5000, 0xab))).toEqual(
    Array.from({ length: 4999 }, (_, i) => i),
  );
  expect(scan('ab '.repeat(513), Buffer.alloc(514, 0xab))).toEqual([0, 1]);
  const backing = new Uint8Array([0, 0xab, 0xcd, 0]);
  expect(scan('ab cd', backing.subarray(1, 3))).toEqual([0]);
});

const fakeDisassembler = {
  disasm(bytes: Buffer) {
    return Array.from({ length: Math.floor(bytes.length / 4) }, (_, i) => ({
      bytes: [...bytes.subarray(i * 4, i * 4 + 4)],
      mnemonic: 'nop',
      op_str: '',
    }));
  },
} as any;

test('signature growth filters candidates and includes final partial increment', async () => {
  const data = Buffer.alloc(200, 0xab);
  data[63] = 0xcd;
  const result = await getUniquePattern(fakeDisassembler, data, data, 0, 64);
  expect(result.length).toBe(64);
  expect(result.matches).toEqual([0]);
  expect(scan(result.pattern, data)).toEqual(result.matches);
});

test('short methods and exhausted disassembly produce bounded signatures', async () => {
  const data = Buffer.from('aabbccdd11223344', 'hex');
  const result = await getUniquePattern(fakeDisassembler, data, data, 0, 8);
  expect(result.length).toBe(8);
  expect(result.matches).toEqual([0]);
  expect((await getUniquePattern(fakeDisassembler, data, data, 0, 300)).length).toBe(8);
  expect((await getUniquePattern(fakeDisassembler, data, data, 0, 0)).matches).toEqual([]);
});

test('unique short signatures avoid decoding the remaining method', async () => {
  const decodedLengths: number[] = [];
  const cs = {
    disasm(bytes: Buffer) {
      decodedLengths.push(bytes.length);
      return fakeDisassembler.disasm(bytes);
    },
  } as any;
  const data = Buffer.alloc(2000);
  data.fill(0xab, 0, 48);
  const result = await getUniquePattern(cs, data, data, 0, 2000);
  expect(result.matches).toEqual([0]);
  expect(result.length).toBe(48);
  expect(decodedLengths).toEqual([48]);
});
