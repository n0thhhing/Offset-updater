import chalk from 'chalk';

export namespace WriteUtil {
  export async function writeOffsets(
    filePath: FilePath,
    newOffsets: any,
  ): Promise<void> {
    const startTime: Time = performance.now();
    const lines: string[] = [];
    for (const offsetInfo of newOffsets) {
      const line: string = `${offsetInfo.offsets} -- ${offsetInfo.name}`;
      lines.push(line);
    }
    Bun.write(Bun.file(filePath), lines.join('\n'));
    const elapsedTime: Time = performance.now() - startTime;
    console.log(
      chalk.grey(
        `writeOffsets(${filePath}): ${chalk.blue(elapsedTime.toFixed(3))}ms`,
      ),
    );
  }

  export async function writePatterns(
    filePath: FilePath,
    newOffsets: any,
  ): Promise<void> {
    const startTime: Time = performance.now();
    const lines: string[] = [];
    for (const offsetInfo of newOffsets) {
      const line: string = `${offsetInfo.pattern} -- ${offsetInfo.name}`;
      lines.push(line);
    }
    Bun.write(Bun.file(filePath), lines.join('\n'));
    const elapsedTime: Time = performance.now() - startTime;
    console.log(
      chalk.grey(
        `writePatterns(${filePath}): ${chalk.blue(elapsedTime.toFixed(3))}ms`,
      ),
    );
  }
}
