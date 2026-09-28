import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface UpdaterConfig {
  oldLibrary: string;
  newLibrary: string;
  offsets: string;
  offsetOutput: string;
  signatureOutput?: string;
  signatureLength: number;
  oldDump?: string;
  xrefResolution?: boolean;
  newDump?: string;
}

/** Paths are relative to the configuration file, not the process working directory. */
export async function readConfig(file: string): Promise<UpdaterConfig> {
  const value: Record<string, unknown> = JSON.parse(await readFile(file, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Config must be an object');
  const directory = path.dirname(path.resolve(file));
  const getPath = (key: string, optional = false): string | undefined => {
    const input = value[key];
    if (optional && input === undefined) return undefined;
    if (typeof input !== 'string' || !input.trim())
      throw new Error(`Config "${key}" must be a nonempty path`);
    return path.resolve(directory, input);
  };
  const signatureLength = value.signatureLength ?? 300;
  const xrefResolution = typeof value.xrefResolution === 'boolean' ? value.xrefResolution : true;
  const newDump = getPath('newDump', true);
  if (
    typeof signatureLength !== 'number' ||
    !Number.isSafeInteger(signatureLength) ||
    signatureLength < 4 ||
    signatureLength % 4
  ) {
    throw new Error('Config "signatureLength" must be a positive multiple of four');
  }
  const config: UpdaterConfig = {
    oldLibrary: getPath('oldLibrary')!,
    newLibrary: getPath('newLibrary')!,
    offsets: getPath('offsets')!,
    offsetOutput: getPath('offsetOutput')!,
    signatureOutput: getPath('signatureOutput', true),
    signatureLength,
    oldDump: getPath('oldDump', true),
    xrefResolution,
    newDump,
  };
  const inputs = [config.oldLibrary, config.newLibrary, config.offsets, config.oldDump];
  const outputs = [config.offsetOutput, config.signatureOutput].filter(
    (file): file is string => !!file,
  );
  if (new Set(outputs).size !== outputs.length || outputs.some((file) => inputs.includes(file))) {
    throw new Error('Output paths must be distinct from each other and all inputs');
  }
  return config;
}
