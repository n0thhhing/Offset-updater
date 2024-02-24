import chalk from 'chalk';

async function getOffsets(filePath: FilePath): Promise<any> {
  const startTime: Time = performance.now();
  const fileContent: string = await Bun.file(filePath).text();
  const lines: string[] = fileContent.split('\n');

  const offsets: string[] = [];
  const names: string[] = [];
  const entries: any[] = [];

  for (const line of lines) {
    if (line.startsWith('--')) {
      continue;
    }

    const match: RegExpMatchArray | null = line.match(
      /^(0x[\dA-Fa-f]+) -- (.+)$/,
    );

    if (match) {
      const [, offset, name]: string[] = match;

      offsets.push(offset);
      names.push(name);

      entries.push({
        offset,
        name,
        description: line,
      });
    }
  }

  const elapsedTime: Time = performance.now() - startTime;

  console.log(
    chalk.grey(
      `getOffsets(${filePath}): ${chalk.blue(elapsedTime.toFixed(3))}ms`,
    ),
  );

  return { offsets, names, entries };
}

export { getOffsets };
