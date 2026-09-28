import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { fixtureRoot } from '../src/io/fixtures';

const tag = process.argv[2] ?? 'fixtures-v1';
const outputDirectory = path.resolve('fixture-release');
const asset = `offset-updater-${tag}.tar.gz`;
const archive = path.join(outputDirectory, asset);
const included = [
  'real-game/old.so',
  'real-game/new.so',
  ...['23.4.2', '23.4.3', '23.5.2', '23.7.0'].flatMap((version) => [
    `real-game/${version}/libil2cpp.so`,
    `real-game/${version}/dump/script.json`,
  ]),
];

mkdirSync(outputDirectory, { recursive: true });
rmSync(archive, { force: true });
const packed = spawnSync('tar', ['-czf', archive, '-C', fixtureRoot, ...included], {
  stdio: 'inherit',
});
if (packed.status !== 0) process.exit(packed.status ?? 1);

const hash = createHash('sha256');
for await (const chunk of createReadStream(archive)) hash.update(chunk);
const sha256 = hash.digest('hex');
console.log(JSON.stringify({ tag, asset, sha256 }, null, 2));
console.log(`Archive: ${archive}`);
console.log(
  `Upload with: gh release create ${tag} ${archive} --title "Portable test fixtures ${tag}"`,
);
