import chalk from 'chalk';
import config from './config/config.json';
import {
  ARCH,
  CS_OPT_DETAIL,
  CS_OPT_SYNTAX,
  Capstone,
  KmpPatternScanner,
  MODE,
  OPT_SKIPDATA,
  OPT_SYNTAX_INTEL,
  WriteUtil,
  getOffsets,
  getPattern,
  readLib,
} from './utils';

const {
  'signature length': sigLength,
  'offset file': offsetFile,
  'old lib': oldLibPath,
  'new lib': newLibPath,
  'offset output': offsetOutput,
  'signature output': patternOutput,
  'output signatures': outputSig,
} = config;

const disassembler = new Capstone(ARCH, MODE);
const offsets = await getOffsets(offsetFile);
const oldBytes = await readLib(oldLibPath);
const newBytes = await readLib(newLibPath);
const newOffsets = [];

disassembler.option(CS_OPT_DETAIL, false);
disassembler.option(CS_OPT_SYNTAX, OPT_SYNTAX_INTEL);
disassembler.option(OPT_SKIPDATA, true);

const startTime = Bun.nanoseconds();
for await (const { offset, name } of offsets.entries) {
  const startNs = Bun.nanoseconds();
  const offsetValue = parseInt(offset);

  if (oldBytes && newBytes) {
    const pattern = await getPattern(
      disassembler,
      oldBytes,
      offsetValue,
      sigLength,
    );
    const hexString = oldBytes.toString(
      'hex',
      offsetValue,
      offsetValue + sigLength,
    );
    const occurrences = KmpPatternScanner.scan(newBytes, pattern);
    const output =
      occurrences.length !== 0
        ? chalk.grey(
            `Pattern found for ${name} at indexes: ${occurrences
              .map((offset) =>
                chalk.blue(`0x${offset.toString(16).toUpperCase()}`),
              )
              .join(', ')}`,
          )
        : chalk.red('Pattern not found');

    console.log(
      output +
        chalk.grey(
          ` ${chalk.blue(((Bun.nanoseconds() - startNs) / 1_000_000).toFixed(3))}ms`,
        ),
    );
    newOffsets.push({
      name,
      offsets: occurrences
        .map((offset) => `0x${offset.toString(16).toUpperCase()}`)
        .join(' '),
      pattern,
    });
  } else {
    console.log(chalk.red('Error reading file'));
  }
}

WriteUtil.writeOffsets(offsetOutput, newOffsets);
if (outputSig) WriteUtil.writePatterns(patternOutput, newOffsets);
const elapsedTime = ((Bun.nanoseconds() - startTime) / 1_000_000).toFixed(3);
console.log(chalk.grey(`Total processing time: ${chalk.blue(elapsedTime)}ms`));
disassembler.close();
