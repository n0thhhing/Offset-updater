import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import release from '../fixtures.release.json';
import { fixtureRoot } from '../src/io/fixtures';

const force = process.argv.includes('--force');
const repository = 'n0thhhing/Offset-updater';
const url = `https://github.com/${repository}/releases/download/${release.tag}/${release.asset}`;
const work = await mkdtemp(path.join(tmpdir(), 'offset-updater-fixtures-'));
const archive = path.join(work, release.asset);
const extracted = path.join(work, 'extracted');

try {
  console.log(`Downloading ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  await pipeline(response.body, createWriteStream(archive));

  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  const actual = hash.digest('hex');
  if (actual !== release.sha256)
    throw new Error(`SHA-256 mismatch: expected ${release.sha256}, got ${actual}`);

  const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  if (listing.status !== 0) throw new Error(listing.stderr || 'Unable to inspect fixture archive');
  const entries = listing.stdout.trim().split('\n').filter(Boolean);
  if (entries.some((entry) => path.isAbsolute(entry) || entry.split('/').includes('..'))) {
    throw new Error('Fixture archive contains an unsafe path');
  }

  await mkdir(extracted, { recursive: true });
  const unpacked = spawnSync('tar', ['-xzf', archive, '-C', extracted], { stdio: 'inherit' });
  if (unpacked.status !== 0) throw new Error('Unable to extract fixture archive');
  const incoming = path.join(extracted, 'real-game');
  await stat(incoming);
  const destination = path.join(fixtureRoot, 'real-game');
  try {
    await stat(destination);
    if (!force) throw new Error(`${destination} already exists; rerun with --force to replace it`);
    await rm(destination, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(fixtureRoot, { recursive: true });
  await rename(incoming, destination);
  console.log(`Installed verified fixtures in ${destination}`);
} finally {
  await rm(work, { recursive: true, force: true });
}
