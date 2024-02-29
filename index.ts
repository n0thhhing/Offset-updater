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
}: UpdaterConfig = config;

const disassembler: Capstone = new Capstone(ARCH, MODE);
const offsets: any = await getOffsets(offsetFile);
const oldBytes: Buffer | null = await readLib(oldLibPath);
const newBytes: Buffer | null = await readLib(newLibPath);
const newOffsets: OffsetInfo[] = [];

disassembler.option(CS_OPT_DETAIL, false);
disassembler.option(CS_OPT_SYNTAX, OPT_SYNTAX_INTEL);
disassembler.option(OPT_SKIPDATA, true);

const startTime = Bun.nanoseconds();
for await (const { offset, name } of offsets.entries) {
    const startNs: Time = Bun.nanoseconds();
    const offsetValue: number = parseInt(offset);

    if (oldBytes && newBytes) {
        const pattern: Pattern = await getPattern(
            disassembler,
            oldBytes,
            offsetValue,
            sigLength,
        );

        const occurrences: number[] = KmpPatternScanner.scan(newBytes, pattern);
        const output =
            occurrences.length !== 0
                ? chalk.grey(
                      `Pattern found for ${name} at indexes: ${occurrences
                          .map((offset: number) =>
                              chalk.blue(
                                  `0x${offset.toString(16).toUpperCase()}`,
                              ),
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
const elapsedTime: Time = (Bun.nanoseconds() - startTime) / 1_000_000;
console.log(
    chalk.grey(
        `Total processing time: ${chalk.blue(elapsedTime.toFixed(3))}ms`,
    ),
);
disassembler.close();
