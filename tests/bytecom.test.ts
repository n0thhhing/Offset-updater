const constInstr = [
  // most likely wont change
  'str', // register value store
  'cmp', // compare
  'ldp', // load register
  'stp', // store register
  'ldur', // load register
  'stur', // store register
  'eor',
  'and',
];

const specialInstr = [
  'cbz',
  'ldr', // id 162
  'movz', // only when the offset is 0 based
];

import { expect, test } from 'bun:test';
import chalk from 'chalk';
import fs from 'fs';
import {
  ARCH,
  CS_OPT_DETAIL,
  CS_OPT_SYNTAX,
  Capstone,
  MODE,
  OPT_SKIPDATA,
  OPT_SYNTAX_INTEL,
  getHexFromOffset,
  getOffsets,
  getStrHex,
  instrIsWildCard,
  readLib,
} from '../utils';
import { BytePatternScanner } from './kmp/kmp.test.ts';

let oldValues: any = [];
let values: any = [];
let isnew = false;
const sigLen = 300;

async function getPattern(
  disassembler: any,
  buffer: Buffer,
  offset: number,
  len: number,
) {
  const hex: Buffer = getHexFromOffset(buffer, offset, len);
  const instructions: Instruction[] = disassembler.disasm(hex, offset);
  let pattern: string = '';
  for (const [index, instr] of instructions.entries()) {
    const { isWildCard, specialByte } = instrIsWildCard(instr);

    if (isWildCard && specialByte) {
      pattern += '??????' + instr.bytes[3].toString(16).padStart(2, '0');
    } else if (isWildCard) {
      pattern += '????????';
    } else {
      pattern += Buffer.from(instr.bytes).toString('hex');
    }
    if (isnew) {
      values.push({
        values: {
          index,
          oldInstructions: oldValues[index],
          newInstruction: {
            isWildCard,
            instr: `${instr.id} 0x${instr.address.toString(16)} ${getStrHex(buffer, instr.address, 4).trimEnd()} ${instr.mnemonic} ${instr.op_str}`,
          },
        },
      });
    } else {
      oldValues.push({
        isWildCard,
        instr: `${instr.id} 0x${instr.address.toString(16)} ${getStrHex(buffer, instr.address, 4).trimEnd()} ${instr.mnemonic} ${instr.op_str}`,
      });
    }
  }
  pattern = pattern.replace(/.{2}/g, '$& ');
  pattern = pattern.trimEnd();
  return pattern;
}

const disassembler = new Capstone(ARCH, MODE);

disassembler.option(CS_OPT_DETAIL, false); // Enable/disable instruction details
disassembler.option(CS_OPT_SYNTAX, OPT_SYNTAX_INTEL); // Set disassembly syntax
disassembler.option(OPT_SKIPDATA, true); // Enable/disable skipping data mode

const buffer = await readLib('./libs/old.so');
const newBuffer = await readLib('libs/new.so');
const oldInfos = await getOffsets('./offsets.txt');
const newInfos = await getOffsets('./tests/new.txt');

for (const [index, entry] of oldInfos.entries.entries()) {
  const { offset, name } = entry;
  const newEntry = newInfos.entries[index];
  const { offset: newOffset, name: newName } = newEntry;

  if (buffer && newBuffer) {
    test(name, async () => {
      oldValues = [];
      const oldHex = getStrHex(buffer, offset, sigLen);
      const newHex = getStrHex(newBuffer, newOffset, sigLen);
      isnew = false;
      const pattern = await getPattern(disassembler, buffer, offset, sigLen);
      isnew = true;
      const newPattern = await getPattern(
        disassembler,
        newBuffer,
        newOffset,
        sigLen,
      );

      const foundOffsets = BytePatternScanner.scan(newBuffer, pattern).map(
        (offset) => `0x${offset.toString(16)}`,
      );
      console.log(
        `0x${parseInt(offset).toString(16)} => ${foundOffsets.length > 0 ? foundOffsets : chalk.red('failed')} ${name}`,
      );
      fs.writeFileSync(
        `tests/debug/${parseInt(offset).toString(16)}-0x${parseInt(newOffset).toString(16)}.json`,
        `// ${name}\n${JSON.stringify(values)}`,
      );
      values = [];
      expect(foundOffsets.length).not.toBe(0);
    });
  } else {
    console.log('error');
  }
}
