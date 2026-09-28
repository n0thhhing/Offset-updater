import { readConfig } from './io/config';
import { updateOffsets } from './updater';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: bun run start [config.json] [--verbose]\nDefault config: config/config.json');
} else {
  try {
    const verbose = args.includes('--verbose');
    const positional = args.filter((arg) => arg !== '--verbose');
    if (positional.length > 1) throw new Error('Expected at most one configuration path');
    const start = performance.now();
    const result = await updateOffsets(
      await readConfig(positional[0] ?? 'config/config.json'),
      verbose ? console.log : undefined,
    );
    console.log(
      `${result.resolved}/${result.total} methods resolved in ${(performance.now() - start).toFixed(2)} ms`,
    );
    if (result.resolved !== result.total) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
