import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { oldLib, newLib, funcs } from '../tests/support/synthetic-fixture';
import { fixturePath } from '../src/io/fixtures';

const output = fixturePath('generated');
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(path.join(output, 'old.bin'), oldLib),
  writeFile(path.join(output, 'new.bin'), newLib),
  writeFile(
    path.join(output, 'offsets.txt'),
    funcs.map((f) => `0x${f.oldOff.toString(16)} -- ${f.name}`).join('\n') + '\n',
  ),
]);
console.log(`Generated ${funcs.length} synthetic methods in ${output}`);
