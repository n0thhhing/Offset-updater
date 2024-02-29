export const Capstone = require('./structures/Capstone.js').Capstone,
    ARCH: Arch = 1, // Arm 64
    MODE: ArmMode = 0, // Arm
    CS_OPT_DETAIL: DisassemblerOpt = 2,
    CS_OPT_SYNTAX: DisassemblerOpt = 1,
    OPT_SKIPDATA: DisassemblerOpt = 5,
    OPT_SYNTAX_INTEL: DisassemblerOpt = 1;
export { getHexFromOffset, getStrHex } from './GetHex';
export { getOffsets } from './GetOffsets';
export { getPattern } from './GetPattern';
export { instrIsWildCard } from './IsWildCard';
export { readLib } from './ReadLib';
export { colorizeDiff } from './colorDiff';
export { ByteScanner } from './structures/ByteScanner';
export { default as cs } from './structures/Capstone.js';
export { WriteUtil } from './structures/WriteUtils';
export { KmpPatternScanner } from './structures/kmp';
