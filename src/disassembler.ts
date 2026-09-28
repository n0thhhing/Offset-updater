import { createNativeDisassembler } from './disassembler/native';
import { createWasmDisassembler } from './disassembler/wasm';

/** Minimal typed boundary around the Capstone Disassembler. */
export interface Instruction {
  address: number;
  bytes: number[];
  mnemonic: string;
  op_str: string;
  size: number;
  id: number;
}

export interface Disassembler {
  disasm(bytes: Uint8Array | Buffer, address: number): Instruction[];
  option(option: number, value: number | boolean): void;
  close(): void;
}

export function createDisassembler(): Disassembler {
  const native = createNativeDisassembler();
  if (native) {
    return native;
  }
  return createWasmDisassembler();
}
