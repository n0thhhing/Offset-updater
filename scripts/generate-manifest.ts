import * as fs from 'fs';
import * as path from 'path';
import { fixturePath } from '../src/io/fixtures';

export interface GenerateManifestOptions {
  oldVersion: string;
  newVersion: string;
  count?: number;
  limit?: number;
  inputPath?: string;
  outputPath?: string;
  oldScriptOverride?: string;
  newScriptOverride?: string;
  append?: boolean;
  log?: (msg: string) => void;
}

export async function generateManifest(options: GenerateManifestOptions): Promise<any> {
  const {
    oldVersion: oldVer,
    newVersion: newVer,
    outputPath = `tests/manifests/${oldVer}-to-${newVer}.json`,
    oldScriptOverride,
    newScriptOverride,
    append = false,
    inputPath,
    log = console.log,
  } = options;

  const limit = options.count ?? options.limit ?? null;

  const oldScriptPath =
    oldScriptOverride || fixturePath('real-game', oldVer, 'dump', 'script.json');
  const newScriptPath =
    newScriptOverride || fixturePath('real-game', newVer, 'dump', 'script.json');

  const oldDump = JSON.parse(fs.readFileSync(oldScriptPath, 'utf8'));
  const newDump = JSON.parse(fs.readFileSync(newScriptPath, 'utf8'));

  const oldMap = new Map<string, number>();
  for (const method of oldDump.ScriptMethod) {
    if (method.Address && method.Name) oldMap.set(method.Name, method.Address);
  }
  const newMap = new Map<string, number>();
  for (const method of newDump.ScriptMethod) {
    if (method.Address && method.Name) newMap.set(method.Name, method.Address);
  }

  let manifest: any = {
    source: 'Generated manifest',
    builds: {
      [oldVer]: { sha256: '' },
      [newVer]: { sha256: '' },
    },
    methods: [],
  };

  if (append && fs.existsSync(outputPath)) {
    manifest = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  }

  const methodData = new Map<string, any>();
  if (append && manifest.methods) {
    for (const m of manifest.methods) {
      methodData.set(m.name, m);
    }
  }

  let addedCount = 0;

  function addMethodToManifest(name: string, statusStr: string = '') {
    if (limit !== null && addedCount >= limit) return false;
    if (!oldMap.has(name) || !newMap.has(name)) return true;
    if (methodData.has(name)) return true; // Don't add duplicate

    let entry = {
      name,
      [oldVer]: { va: oldMap.get(name) },
      [newVer]: { va: newMap.get(name) },
      expected: {
        status: 'unique',
        strategy: 'exact',
        length: 48,
        sourceMatches: 1,
        destinationMatches: 1,
        includesExpected: true,
      },
    };

    const exp = entry.expected;
    if (statusStr) {
      if (statusStr.includes('resolved at')) {
        exp.status = 'unique';
        exp.strategy = 'exact';
        const bytesMatch = statusStr.match(/\((\d+) bytes/);
        if (bytesMatch) exp.length = parseInt(bytesMatch[1], 10);
      } else if (statusStr.includes('ambiguous')) {
        exp.status = 'ambiguous';
        exp.strategy = 'exact';
        const matchCount = statusStr.match(/\((\d+) matches/);
        if (matchCount) {
          exp.sourceMatches = parseInt(matchCount[1], 10);
          exp.destinationMatches = parseInt(matchCount[1], 10);
        }
      } else if (statusStr.includes('not found')) {
        exp.status = 'not_found';
        exp.strategy = 'exact';
        exp.sourceMatches = 0;
        exp.destinationMatches = 0;
      }
    }

    methodData.set(name, entry);
    addedCount++;
    return true;
  }

  if (inputPath && fs.existsSync(inputPath)) {
    const inputLines = fs.readFileSync(inputPath, 'utf8').split('\n');
    for (const line of inputLines) {
      if (limit !== null && addedCount >= limit) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      let name = '';
      let statusStr = '';
      if (trimmed.includes(': ')) {
        const parts = trimmed.split(': ');
        name = parts[0];
        statusStr = parts.slice(1).join(': ').trim();
      } else if (trimmed.includes(' -- ')) {
        name = trimmed.split(' -- ')[1];
      } else if (trimmed.includes(' // ')) {
        name = trimmed.split(' // ')[1];
      } else if (!trimmed.startsWith('0x') && !trimmed.includes(' ')) {
        name = trimmed;
      } else {
        continue;
      }
      addMethodToManifest(name, statusStr);
    }
  } else {
    // Pick from common methods
    for (const name of oldMap.keys()) {
      if (limit !== null && addedCount >= limit) break;
      if (newMap.has(name)) {
        addMethodToManifest(name);
      }
    }
  }

  manifest.methods = Array.from(methodData.values());
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  }
  return manifest;
}

if (import.meta.main) {
  const rawArgs = process.argv.slice(2);
  const positionals: string[] = [];
  let append = false;
  let oldScriptOverride: string | null = null;
  let newScriptOverride: string | null = null;
  let limit: number | null = null;
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--append') {
      append = true;
    } else if (arg === '--old-script') {
      oldScriptOverride = rawArgs[++i];
    } else if (arg === '--new-script') {
      newScriptOverride = rawArgs[++i];
    } else if (arg === '--limit' || arg === '--count') {
      limit = parseInt(rawArgs[++i], 10);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length < 2) {
    console.error(
      'Usage: bun generate-manifest.ts <old_version> <new_version> [input_file] [output_file] [--append] [--limit <amount>]',
    );
    process.exit(1);
  }

  const oldVer = positionals[0];
  const newVer = positionals[1];

  if (positionals.length > 2) {
    if (positionals[2].endsWith('.json')) {
      outputPath = positionals[2];
    } else {
      inputPath = positionals[2];
    }
  }
  if (positionals.length > 3) {
    outputPath = positionals[3];
  }

  generateManifest({
    oldVersion: oldVer,
    newVersion: newVer,
    append,
    oldScriptOverride: oldScriptOverride || undefined,
    newScriptOverride: newScriptOverride || undefined,
    limit: limit || undefined,
    inputPath: inputPath || undefined,
    outputPath: outputPath || undefined,
  });
}
