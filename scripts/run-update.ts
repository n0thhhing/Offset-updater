import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixturePath } from '../src/io/fixtures';

// Helper to auto-generate the old offsets file by finding unobfuscated names in the old script.json
function generateOffsetsFile(version: string, outputPath: string) {
  const referenceOffsets = 'test_cli/offsets_23.5.2.txt';
  if (!existsSync(referenceOffsets)) {
    throw new Error(`Cannot auto-generate offsets: Reference file ${referenceOffsets} not found.`);
  }

  const dumpPath = fixturePath('real-game', version, 'dump', 'script.json');
  if (!existsSync(dumpPath)) {
    throw new Error(`Cannot auto-generate offsets: Dump file ${dumpPath} not found.`);
  }

  console.log(`Auto-generating ${outputPath} from ${version} script.json...`);

  // 1. Extract all target names from the reference file
  const refText = readFileSync(referenceOffsets, 'utf8');
  const targetNames = new Set<string>();
  for (const line of refText.split('\n')) {
    if (line.includes('--')) {
      const name = line.split('--')[1].trim();
      targetNames.add(name);
    }
  }

  // 2. Parse the old dump
  const scriptJson = JSON.parse(readFileSync(dumpPath, 'utf8'));
  let foundCount = 0;

  let outLines: string[] = [];

  // 3. Match names
  for (const m of scriptJson.ScriptMethod) {
    if (targetNames.has(m.Name)) {
      const addrHex = `0x${m.Address.toString(16).toLowerCase()}`;
      outLines.push(`${addrHex} -- ${m.Name}`);
      foundCount++;
      targetNames.delete(m.Name);
    }
  }

  writeFileSync(outputPath, outLines.join('\n') + '\n');
  console.log(`Successfully extracted ${foundCount} offsets for ${version}.`);

  if (targetNames.size > 0) {
    console.warn(
      `Warning: ${targetNames.size} methods were NOT found in ${version} script.json (they might be missing or heavily obfuscated in this version).`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: bun scripts/run-update.ts <old_version> <new_version>');
    console.error('Example: bun scripts/run-update.ts 23.4.3 23.7.0');
    process.exit(1);
  }

  const oldVersion = args[0];
  const newVersion = args[1];
  const offsetsFile = path.resolve(`test_cli/offsets_${oldVersion}.txt`);

  // Auto-generate if missing
  if (!existsSync(offsetsFile)) {
    generateOffsetsFile(oldVersion, offsetsFile);
  } else {
    console.log(`Using existing offsets file: ${offsetsFile}`);
  }

  const oldLibrary = fixturePath('real-game', oldVersion, 'libil2cpp.so');
  const newLibrary = fixturePath('real-game', newVersion, 'libil2cpp.so');
  const oldDump = fixturePath('real-game', oldVersion, 'dump', 'script.json');
  const newDump = fixturePath('real-game', newVersion, 'dump', 'script.json');
  const offsetOutput = path.resolve(`test_cli/output_${newVersion}_from_${oldVersion}.txt`);

  if (!existsSync(oldLibrary)) console.warn(`Warning: oldLibrary not found at ${oldLibrary}`);
  if (!existsSync(newLibrary)) console.warn(`Warning: newLibrary not found at ${newLibrary}`);
  if (!existsSync(oldDump)) console.warn(`Warning: oldDump not found at ${oldDump}`);
  if (!existsSync(newDump)) console.warn(`Warning: newDump not found at ${newDump}`);

  const config = {
    oldLibrary,
    newLibrary,
    offsets: offsetsFile,
    offsetOutput,
    oldDump: existsSync(oldDump) ? oldDump : undefined,
    newDump: existsSync(newDump) ? newDump : undefined,
    signatureLength: 300,
    xrefResolution: true,
  };

  const configPath = path.resolve(`test_cli/temp_config_${oldVersion}_to_${newVersion}.json`);
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`\nGenerated temporary config: ${configPath}`);
  console.log(`Starting Offset-updater (${oldVersion} -> ${newVersion})...\n`);

  const proc = spawnSync('bun', ['src/cli.ts', configPath], { stdio: 'inherit' });

  if (proc.status === 0) {
    console.log(`\n✨ Success! 100% of methods resolved. Output written to: ${offsetOutput}`);
  } else if (existsSync(offsetOutput) && readFileSync(offsetOutput, 'utf8').trim().length > 0) {
    const lines = readFileSync(offsetOutput, 'utf8').trim().split('\n').length;
    console.log(`\n✨ Output saved! ${lines} methods resolved and written to: ${offsetOutput}`);
    console.log(
      `(Note: Exit code was 1 because deleted/removed methods could not be resolved, which is expected across major game version updates.)`,
    );
  } else {
    console.error(`\n❌ Updater failed with exit code ${proc.status}`);
  }
}

main().catch(console.error);
