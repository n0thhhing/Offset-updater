import { readFile } from 'node:fs/promises';
import { readMetadata } from '../src/binary/metadata';
import { createDisassembler } from '../src/disassembler';
import { existsSync } from 'node:fs';
import path from 'node:path';

async function main() {
  const args = process.argv.slice(2);
  const version = args[0];
  const methodName = args[1];

  if (!version || !methodName) {
    console.error('Usage: bun scripts/disasm.ts <version> "Method$$Name"');
    console.error('Example: bun scripts/disasm.ts 23.7.0 "WeaponManager$$Start"');
    process.exit(1);
  }

  const basePath = path.join(process.cwd(), 'fixtures', 'real-game', version);
  const libraryPath = path.join(basePath, 'libil2cpp.so');
  const dumpPath = path.join(basePath, 'dump', 'script.json');

  if (!existsSync(libraryPath)) {
    console.error(`Library not found: ${libraryPath}`);
    process.exit(1);
  }

  if (!existsSync(dumpPath)) {
    console.error(`Dump not found: ${dumpPath}`);
    process.exit(1);
  }

  console.log(`Loading metadata from ${dumpPath}...`);
  const scriptJson = JSON.parse(await readFile(dumpPath, 'utf8'));
  let targetMethod = scriptJson.ScriptMethod.find(
    (m: any) => m.Name === methodName || m.Name.includes(methodName),
  );

  if (!targetMethod) {
    console.error(`Method ${methodName} not found in ${dumpPath}`);
    process.exit(1);
  }

  const offset = Number(targetMethod.Address);
  console.log(`Found ${targetMethod.Name} at 0x${offset.toString(16).toUpperCase()}`);

  const metadata = await readMetadata(dumpPath);
  const next = metadata.nextAddress(offset);
  let length = next !== undefined ? next - offset : 200;
  if (length > 2000) length = 200;

  console.log(`Reading ${length} bytes from ${libraryPath}...`);
  const buf = await readFile(libraryPath);

  const d = createDisassembler();
  try {
    const insns = d.disasm(buf.subarray(offset, offset + length), offset);
    console.log('\n--- Disassembly ---');
    for (const i of insns) {
      console.log(
        `0x${i.address.toString(16).toUpperCase().padStart(8, '0')}:  ${i.mnemonic.padEnd(8)} ${i.op_str}`,
      );
    }
    console.log('-------------------\n');
  } finally {
    d.close();
  }
}

main().catch(console.error);
