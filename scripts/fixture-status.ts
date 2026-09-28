import { stat } from 'node:fs/promises';
import { fixturePath, fixtureRoot } from '../src/io/fixtures';

const required = [
  ['real-game', '23.4.2', 'libil2cpp.so'],
  ['real-game', '23.4.2', 'dump', 'script.json'],
  ['real-game', '23.4.3', 'libil2cpp.so'],
  ['real-game', '23.4.3', 'dump', 'script.json'],
  ['real-game', '23.5.2', 'libil2cpp.so'],
  ['real-game', '23.5.2', 'dump', 'script.json'],
  ['real-game', '23.7.0', 'libil2cpp.so'],
  ['real-game', '23.7.0', 'dump', 'script.json'],
];

console.log(`Fixture root: ${fixtureRoot}`);
let missing = 0;
for (const segments of required) {
  const file = fixturePath(...segments);
  try {
    const info = await stat(file);
    console.log(`ok      ${segments.join('/')} (${(info.size / 1024 / 1024).toFixed(1)} MiB)`);
  } catch {
    missing++;
    console.log(`missing ${segments.join('/')}`);
  }
}

if (missing) {
  console.error(`Missing ${missing}/${required.length} required real-game fixture files.`);
  process.exitCode = 1;
}
