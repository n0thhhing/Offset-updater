import * as fs from 'fs';
import { fixturePath } from '../src/io/fixtures';

let inputTxt = 'test_cli/offsets.txt';
let outputTxt = 'test_cli/output.txt';
let scriptJson = fixturePath('real-game', '23.5.2', 'dump', 'script.json');

const args = process.argv.slice(2);
if (args.length === 3) {
  inputTxt = args[0];
  outputTxt = args[1];
  scriptJson = args[2];
} else if (args.length === 2) {
  outputTxt = args[0];
  scriptJson = args[1];
} else if (args.length === 1) {
  console.error('Usage: bun verify_offsets.ts [input_offsets.txt] <output.txt> <script.json>');
  process.exit(1);
}

if (!fs.existsSync(outputTxt)) {
  console.error(`Error: Could not find output file at ${outputTxt}`);
  process.exit(1);
}
if (!fs.existsSync(scriptJson)) {
  console.error(`Error: Could not find ground truth dump at ${scriptJson}`);
  process.exit(1);
}

console.log(`Original Input Offsets: ${inputTxt}`);
console.log(`Updated Output Offsets: ${outputTxt}`);
console.log(`Ground Truth Dump: ${scriptJson}\n`);

const dump = JSON.parse(fs.readFileSync(scriptJson, 'utf8'));
const groundTruth = new Map<string, number>();

for (const method of dump.ScriptMethod) {
  if (method.Address && method.Name) {
    groundTruth.set(method.Name, method.Address);
  }
}

// Parse input if available
let originalCount = 0;
if (fs.existsSync(inputTxt)) {
  const inputLines = fs.readFileSync(inputTxt, 'utf8').split('\n');
  for (const line of inputLines) {
    if (line.includes('//') || line.includes('--')) originalCount++;
  }
}

const outputLines = fs.readFileSync(outputTxt, 'utf8').split('\n');

let correct = 0;
let incorrect = 0;
let missingInDump = 0;
const incorrectDetails: string[] = [];

for (const line of outputLines) {
  const parts = line.split(' -- ');
  if (parts.length !== 2) continue;

  const actualAddr = parseInt(parts[0].trim(), 16);
  const name = parts[1].trim();

  if (!groundTruth.has(name)) {
    missingInDump++;
    continue;
  }

  const expectedAddr = groundTruth.get(name)!;

  if (actualAddr === expectedAddr) {
    correct++;
  } else {
    incorrect++;
    incorrectDetails.push(
      `Mismatch: ${name} -> Got: 0x${actualAddr.toString(16).toUpperCase()}, Expected: 0x${expectedAddr.toString(16).toUpperCase()}`,
    );
  }
}

console.log('--- VERIFICATION RESULTS ---');
if (originalCount > 0) {
  console.log(`Original input offsets: ${originalCount}`);
}
const outputCount = correct + incorrect + missingInDump;
console.log(`Total resolved in output: ${outputCount}`);
console.log(`Verified correct against dump: ${correct}`);
console.log(`Verified incorrect against dump: ${incorrect}`);

if (missingInDump > 0) {
  console.log(
    `Not found in ground truth script.json: ${missingInDump} (likely renamed or compiler-generated)`,
  );
}

if (incorrect > 0) {
  console.log('\n--- INCORRECT DETAILS ---');
  for (const detail of incorrectDetails) {
    console.log(detail);
  }
  process.exit(1);
} else {
  console.log('\nALL RESOLVED OFFSETS PERFECTLY MATCH GROUND TRUTH! 🎉');
}
