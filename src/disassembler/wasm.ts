import { createRequire } from 'module';
import type { Disassembler } from '../disassembler';

export function createWasmDisassembler(): Disassembler {
  let req = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
  const { Capstone } = req('../../vendor/capstone/capstone.cjs') as any;
  const disassembler = new Capstone(1, 0); // AArch64, little-endian
  disassembler.option(2, false); // No instruction details
  disassembler.option(1, 1); // Intel syntax
  disassembler.option(5, true); // Skip undecodable data
  return disassembler;
}
