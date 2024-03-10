import config from './config/config.json';
import {
  ARCH,
  CS_OPT_DETAIL,
  CS_OPT_SYNTAX,
  Capstone,
  MODE,
  OPT_SKIPDATA,
  OPT_SYNTAX_INTEL,
  WriteUtil,
  color,
  getOffsets,
  getPattern,
  readHex,
  readLib,
  scan,
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
const startTime = process.hrtime.bigint();
const newOffsets = [];
const readLibraries = Promise.all([readLib(oldLibPath), readHex(newLibPath)]);
const offsets = await getOffsets(offsetFile);

disassembler.option(CS_OPT_DETAIL, false);
disassembler.option(CS_OPT_SYNTAX, OPT_SYNTAX_INTEL);
disassembler.option(OPT_SKIPDATA, true);

const backupPatternRegex = /(.. .. .. (?:f9|39))/g;
const blue = color.Blue;
const grey = color.Grey;
const red = color.Red;

for (const { offset, name } of offsets.entries) {
  let backupOccurrences: any[] = [];
  const startNs = process.hrtime.bigint();
  let offsetValue = parseInt(offset);

  try {
    const [oldBytes, newBytes] = await readLibraries;

    if (oldBytes && newBytes) {
      const pattern = await getPattern(
        disassembler,
        oldBytes,
        offsetValue,
        sigLength,
      );
      const occurrences = scan(pattern, newBytes);

      if (occurrences.length === 0) {
        backupOccurrences = scan(
          pattern.replace(backupPatternRegex, '?? ?? ?? $1'),
          newBytes,
        );
      }

      const foundMessage =
        occurrences.length !== 0
          ? `Pattern found for ${name} at indexes: ${occurrences.map((offset) => blue(`0x${offset.toString(16).toUpperCase()}`)).join(', ')}`
          : backupOccurrences.length > 0
            ? `Pattern found for ${name} at indexes: ${backupOccurrences.map((offset) => blue(`0x${offset.toString(16).toUpperCase()}`)).join(', ')}`
            : red(
                `Pattern not found for ${name}${grey(`(${color.Yellow(offset)})`)}`,
              );

      const elapsedTime = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      const output = `${grey(foundMessage)} ${grey(`${blue(elapsedTime.toFixed(3))}ms`)}`;
      console.log(output);

      if (occurrences.length > 0 || backupOccurrences.length > 0) {
        newOffsets.push({
          name,
          offsets: occurrences
            .concat(backupOccurrences)
            .map((offset) => `0x${offset.toString(16).toUpperCase()}`)
            .join(' '),
          pattern,
        });
      }
    } else {
      console.log(red('Error reading file'));
    }
  } catch (error) {
    console.error(red('Error:', error));
  }
}

WriteUtil.writeOffsets(offsetOutput, newOffsets);
if (outputSig) WriteUtil.writePatterns(patternOutput, newOffsets);

const elapsedTime = Number(process.hrtime.bigint() - startTime) / 1_000_000;
console.log(grey(`Total processing time: ${blue(elapsedTime.toFixed(3))}ms`));
disassembler.close();
