import path from 'path';
import fs from 'fs';
import type { Disassembler, Instruction } from '../disassembler';

export function createNativeDisassembler(): Disassembler | null {
  let nativeLib: any = null;
  let ffiPtr: any = null;

  try {
    // @ts-ignore
    if (typeof Bun !== 'undefined') {
      const { dlopen, FFIType, ptr } = require('bun:ffi');
      const dylibPath = path.resolve(import.meta.dir, '..', '..', 'native', 'libcore.dylib');

      if (fs.existsSync(dylibPath)) {
        const lib = dlopen(dylibPath, {
          get_capstone_handle: {
            args: [],
            returns: FFIType.ptr, // csh
          },
          disasm_arm64: {
            args: [
              FFIType.ptr, // csh handle
              FFIType.ptr, // code
              FFIType.u64, // code_size
              FFIType.u64, // address
              FFIType.ptr, // out_insns
              FFIType.u64, // max_insns
            ],
            returns: FFIType.u64,
          },
        });
        nativeLib = lib.symbols;
        ffiPtr = ptr;
      }
    }
  } catch (e) {
    return null;
  }

  if (!nativeLib) return null;

  const handle = nativeLib.get_capstone_handle();
  if (!handle) return null;

  const MAX_INSNS = 256;
  const STRUCT_SIZE = 224;
  const buf = Buffer.alloc(MAX_INSNS * STRUCT_SIZE);
  const dataView = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  return {
    disasm(bytes: Uint8Array | Buffer, address: number): Instruction[] {
      const codeBuf = Buffer.isBuffer(bytes)
        ? bytes
        : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      const count = Number(
        nativeLib.disasm_arm64(
          handle,
          ffiPtr(codeBuf),
          BigInt(codeBuf.length),
          BigInt(address),
          ffiPtr(buf),
          BigInt(MAX_INSNS),
        ),
      );

      const res: Instruction[] = new Array(count);
      for (let i = 0; i < count; i++) {
        const base = i * STRUCT_SIZE;
        const addr = Number(dataView.getBigUint64(base, true));
        const size = dataView.getUint16(base + 8, true);

        let m_len = 0;
        while (m_len < 32 && buf[base + 10 + m_len] !== 0) m_len++;
        const mnemonic = buf.toString('utf8', base + 10, base + 10 + m_len);

        let o_len = 0;
        while (o_len < 160 && buf[base + 42 + o_len] !== 0) o_len++;
        const op_str = buf.toString('utf8', base + 42, base + 42 + o_len);

        const instrBytes = new Array(size);
        for (let b = 0; b < size; b++) {
          instrBytes[b] = buf[base + 202 + b];
        }

        res[i] = {
          address: addr,
          size,
          mnemonic,
          op_str,
          bytes: instrBytes,
          id: 0,
        };
      }
      return res;
    },
    option() {},
    close() {},
  };
}
