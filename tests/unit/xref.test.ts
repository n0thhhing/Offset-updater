import { expect, test } from 'bun:test';
import { xrefResolve } from '../../src/binary/xref';

function writeBl(bytes: Buffer, offset: number, target: number) {
  const displacement = (target - offset) / 4;
  bytes.writeUInt32LE((0x94000000 | (displacement & 0x03ffffff)) >>> 0, offset);
}

test('outgoing-call fingerprints select the candidate calling the verified destination', () => {
  const source = Buffer.alloc(1024);
  const destination = Buffer.alloc(1024);
  writeBl(source, 100, 300);
  writeBl(destination, 500, 800);
  writeBl(destination, 600, 900);

  const result = xrefResolve({
    source,
    destination,
    pending: [
      {
        name: 'pending',
        sourceOffset: 100,
        sourceBodyLength: 32,
        candidates: [500, 600],
      },
    ],
    resolved: [{ sourceOffset: 300, destOffset: 800, sourceBodyLength: 32 }],
  });

  expect(result.get('pending')).toBe(500);
});

test('outgoing-call fingerprints preserve ambiguity when candidates agree', () => {
  const source = Buffer.alloc(1024);
  const destination = Buffer.alloc(1024);
  writeBl(source, 100, 300);
  writeBl(destination, 500, 800);
  writeBl(destination, 600, 800);

  const result = xrefResolve({
    source,
    destination,
    pending: [
      {
        name: 'pending',
        sourceOffset: 100,
        sourceBodyLength: 32,
        candidates: [500, 600],
      },
    ],
    resolved: [{ sourceOffset: 300, destOffset: 800, sourceBodyLength: 32 }],
  });

  expect(result.has('pending')).toBe(false);
});
