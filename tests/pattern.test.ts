import { expect, test } from 'bun:test';
import chalk from 'chalk';
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
    }
    pattern = pattern.replace(/.{2}/g, '$& ');
    pattern = pattern.trimEnd();
    return pattern;
}

const sigLen = 300;
const disassembler = new Capstone(ARCH, MODE);
const buffer = await readLib('./libs/old.so');
const newBuffer = await readLib('libs/new.so');
const oldInfos = await getOffsets('./offsets.txt');

disassembler.option(CS_OPT_DETAIL, false); // Enable/disable instruction details
disassembler.option(CS_OPT_SYNTAX, OPT_SYNTAX_INTEL); // Set disassembly syntax
disassembler.option(OPT_SKIPDATA, true); // Enable/disable skipping data mode

for (const [index, entry] of oldInfos.entries.entries()) {
    const { offset, name } = entry;

    if (buffer && newBuffer) {
        test(name, async () => {
            const oldHex = getStrHex(buffer, offset, sigLen);
            const pattern = await getPattern(
                disassembler,
                buffer,
                offset,
                sigLen,
            );

            const foundOffsets = BytePatternScanner.scan(
                newBuffer,
                pattern,
            ).map((offset) => `0x${offset.toString(16)}`);
            console.log(
                `0x${parseInt(offset).toString(16)} => ${foundOffsets.length > 0 ? foundOffsets : chalk.red('failed')} ${name}`,
            );
            expect(foundOffsets.length).not.toBe(0);
        });
    } else {
        console.log('error');
    }
}
