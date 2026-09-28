import path from 'node:path';

/** Resolve fixtures from an external directory or this repository's fixtures folder. */
export const fixtureRoot = path.resolve(
  process.env.OFFSET_UPDATER_FIXTURES_DIR ?? path.resolve(import.meta.dir, '../..', 'fixtures'),
);

export function fixturePath(...segments: string[]): string {
  return path.join(fixtureRoot, ...segments);
}
