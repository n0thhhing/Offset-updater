import { readFile } from 'node:fs/promises';
import { readMetadata } from '../src/binary/metadata';
import { createDisassembler, type Disassembler, type Instruction } from '../src/disassembler';
import { existsSync } from 'node:fs';
import path from 'node:path';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[90m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';

async function getMethodData(version: string, methodName: string, d: Disassembler) {
  const basePath = path.join(process.cwd(), 'fixtures', 'real-game', version);
  const libraryPath = path.join(basePath, 'libil2cpp.so');
  const dumpPath = path.join(basePath, 'dump', 'script.json');

  if (!existsSync(libraryPath)) throw new Error(`Library not found: ${libraryPath}`);
  if (!existsSync(dumpPath)) throw new Error(`Dump not found: ${dumpPath}`);

  const scriptJson = JSON.parse(await readFile(dumpPath, 'utf8'));
  let targetMethod = scriptJson.ScriptMethod.find(
    (m: any) => m.Name === methodName || m.Name.includes(methodName),
  );

  if (!targetMethod) throw new Error(`Method ${methodName} not found in ${version}`);

  const offset = Number(targetMethod.Address);
  const metadata = await readMetadata(dumpPath);
  const next = metadata.nextAddress(offset);
  let length = next !== undefined ? next - offset : 200;
  if (length > 2000) length = 200;

  const buf = await readFile(libraryPath);
  const insns = d.disasm(buf.subarray(offset, offset + length), offset);

  return {
    name: targetMethod.Name,
    address: offset,
    insns,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error("Usage: bun scripts/compare.ts <version1> 'Method$$1' <version2> 'Method$$2'");
    process.exit(1);
  }

  const v1 = args[0];
  const m1 = args[1];
  const v2 = args[2];
  const m2 = args[3];

  const d = createDisassembler();
  try {
    const data1 = await getMethodData(v1, m1, d);
    const data2 = await getMethodData(v2, m2, d);

    const map1 = new Map<number, Instruction>();
    for (const i of data1.insns) map1.set(i.address - data1.address, i);

    const map2 = new Map<number, Instruction>();
    for (const i of data2.insns) map2.set(i.address - data2.address, i);

    const allOffsets = Array.from(new Set([...map1.keys(), ...map2.keys()])).sort((a, b) => a - b);

    const colWidth = 60;

    // Header
    const name1 = `[${v1}] ${data1.name}`;
    const name2 = `[${v2}] ${data2.name}`;

    console.log('┌' + '─'.repeat(colWidth + 2) + '┬' + '─'.repeat(colWidth + 2) + '┐');
    console.log(
      '│ ' +
        BOLD +
        BLUE +
        name1.padEnd(colWidth) +
        RESET +
        ' │ ' +
        BOLD +
        BLUE +
        name2.padEnd(colWidth) +
        RESET +
        ' │',
    );
    console.log('├' + '─'.repeat(colWidth + 2) + '┼' + '─'.repeat(colWidth + 2) + '┤');

    let diffCount = 0;

    for (const offset of allOffsets) {
      const i1 = map1.get(offset);
      const i2 = map2.get(offset);

      const offHex = `+0x${offset.toString(16).padStart(4, '0')}`;
      const offStr = `${DIM}${offHex}: ${RESET}`;

      let raw1 = i1 ? `${offHex}: ${i1.mnemonic.padEnd(8)} ${i1.op_str}` : '';
      let raw2 = i2 ? `${offHex}: ${i2.mnemonic.padEnd(8)} ${i2.op_str}` : '';

      let s1 = '',
        s2 = '';

      if (!i1 && i2) {
        s1 = ' '.repeat(colWidth);
        s2 = `${offStr}${GREEN}${i2.mnemonic.padEnd(8)} ${i2.op_str}${RESET}`;
        s2 += ' '.repeat(Math.max(0, colWidth - raw2.length));
        diffCount++;
      } else if (i1 && !i2) {
        s1 = `${offStr}${RED}${i1.mnemonic.padEnd(8)} ${i1.op_str}${RESET}`;
        s1 += ' '.repeat(Math.max(0, colWidth - raw1.length));
        s2 = ' '.repeat(colWidth);
        diffCount++;
      } else if (i1 && i2) {
        if (i1.mnemonic === i2.mnemonic && i1.op_str === i2.op_str) {
          s1 = `${DIM}${raw1.padEnd(colWidth)}${RESET}`;
          s2 = `${DIM}${raw2.padEnd(colWidth)}${RESET}`;
        } else {
          // Precise highlighting
          s1 = offStr;
          s2 = offStr;

          if (i1.mnemonic !== i2.mnemonic) {
            s1 += `${BOLD}${RED}${i1.mnemonic.padEnd(8)}${RESET} `;
            s2 += `${BOLD}${GREEN}${i2.mnemonic.padEnd(8)}${RESET} `;
          } else {
            s1 += `${i1.mnemonic.padEnd(8)} `;
            s2 += `${i2.mnemonic.padEnd(8)} `;
          }

          if (i1.op_str !== i2.op_str) {
            s1 += `${RED}${i1.op_str}${RESET}`;
            s2 += `${GREEN}${i2.op_str}${RESET}`;
          } else {
            s1 += `${i1.op_str}`;
            s2 += `${i2.op_str}`;
          }

          s1 += ' '.repeat(Math.max(0, colWidth - raw1.length));
          s2 += ' '.repeat(Math.max(0, colWidth - raw2.length));
          diffCount++;
        }
      }

      console.log(`│ ${s1} │ ${s2} │`);
    }

    console.log('└' + '─'.repeat(colWidth + 2) + '┴' + '─'.repeat(colWidth + 2) + '┘');
    console.log(
      `\n${BOLD}${diffCount === 0 ? GREEN : RED}Comparison complete. ${diffCount} instruction(s) differ.${RESET}\n`,
    );
  } catch (e: any) {
    console.error(e.message);
  } finally {
    d.close();
  }
}

main().catch(console.error);
