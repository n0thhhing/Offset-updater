import * as fs from 'fs';

export interface DiffEntry {
  name: string;
  status: 'matched' | 'shifted' | 'added' | 'removed' | 'ambiguous';
  oldOffsets?: number[];
  newOffsets?: number[];
  delta?: number;
}

export interface DiffSummary {
  matched: number;
  shifted: number;
  added: number;
  removed: number;
  ambiguous: number;
  entries: DiffEntry[];
}

export function parseOffsetLines(content: string): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;

    const parts = trimmed.split(/\s*--\s*/);
    if (parts.length < 2) continue;

    const name = parts[1].trim();
    const rawOffsets = parts[0].trim().split(/\s+/);
    const parsedOffsets: number[] = [];

    for (const raw of rawOffsets) {
      const clean = raw.split('|')[0].trim();
      const num = parseInt(clean, 16);
      if (!isNaN(num)) {
        parsedOffsets.push(num);
      }
    }

    if (parsedOffsets.length > 0) {
      result.set(name, parsedOffsets);
    }
  }

  return result;
}

export function diffOffsets(fileAContent: string, fileBContent: string): DiffSummary {
  const mapA = parseOffsetLines(fileAContent);
  const mapB = parseOffsetLines(fileBContent);

  const allNames = new Set([...mapA.keys(), ...mapB.keys()]);
  const entries: DiffEntry[] = [];

  let matched = 0;
  let shifted = 0;
  let added = 0;
  let removed = 0;
  let ambiguous = 0;

  for (const name of allNames) {
    const a = mapA.get(name);
    const b = mapB.get(name);

    if (a && !b) {
      removed++;
      entries.push({ name, status: 'removed', oldOffsets: a });
    } else if (!a && b) {
      added++;
      entries.push({ name, status: 'added', newOffsets: b });
    } else if (a && b) {
      if (a.length > 1 || b.length > 1) {
        ambiguous++;
        entries.push({ name, status: 'ambiguous', oldOffsets: a, newOffsets: b });
      } else {
        const offA = a[0];
        const offB = b[0];
        if (offA === offB) {
          matched++;
          entries.push({ name, status: 'matched', oldOffsets: a, newOffsets: b, delta: 0 });
        } else {
          shifted++;
          const delta = offB - offA;
          entries.push({ name, status: 'shifted', oldOffsets: a, newOffsets: b, delta });
        }
      }
    }
  }

  return { matched, shifted, added, removed, ambiguous, entries };
}

export function formatTerminalTable(summary: DiffSummary): string {
  const lines: string[] = [];
  lines.push(
    `Summary: ${summary.matched} matched, ${summary.shifted} shifted, ${summary.added} added, ${summary.removed} removed, ${summary.ambiguous} ambiguous`,
  );
  lines.push('--------------------------------------------------------------------------------');
  lines.push('Status     | Method Name                                        | Delta');
  lines.push('--------------------------------------------------------------------------------');

  for (const e of summary.entries) {
    let statusStr = e.status.toUpperCase();
    if (e.status === 'removed') statusStr = 'REMOVED';
    let deltaStr =
      e.delta !== undefined
        ? e.delta >= 0
          ? `+0x${e.delta.toString(16)}`
          : `-0x${Math.abs(e.delta).toString(16)}`
        : '-';
    lines.push(`${statusStr.padEnd(10)} | ${e.name.padEnd(50)} | ${deltaStr}`);
  }

  return lines.join('\n');
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: bun scripts/diff-offsets.ts <old_offsets.txt> <new_offsets.txt>');
    process.exit(1);
  }
  const fileA = fs.readFileSync(args[0], 'utf8');
  const fileB = fs.readFileSync(args[1], 'utf8');
  const summary = diffOffsets(fileA, fileB);
  console.log(formatTerminalTable(summary));
}
