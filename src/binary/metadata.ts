import { readFile } from 'node:fs/promises';

export interface MethodIdentity {
  va: number;
  signature?: string;
}
export interface DumpMethod {
  Name: string;
  Address: number;
  Signature: string;
}

export class MethodMetadata {
  readonly names = new Map<string, DumpMethod[]>();
  readonly next = new Map<number, number>();
  readonly addresses: number[];

  constructor(methods: DumpMethod[]) {
    if (!Array.isArray(methods) || !methods.length)
      throw new Error('Dump contains no ScriptMethod entries');
    for (const method of methods) {
      if (
        !Number.isSafeInteger(method.Address) ||
        method.Address < 0 ||
        typeof method.Name !== 'string' ||
        typeof method.Signature !== 'string'
      ) {
        throw new Error('Invalid method metadata');
      }
      const entries = this.names.get(method.Name) ?? [];
      entries.push(method);
      this.names.set(method.Name, entries);
    }
    this.addresses = [
      ...new Set(methods.map((method) => method.Address).filter((address) => address > 0)),
    ].sort((a, b) => a - b);
    for (let i = 0; i < this.addresses.length - 1; i++)
      this.next.set(this.addresses[i], this.addresses[i + 1]);
  }

  identify(name: string, signature?: string): DumpMethod[] {
    const methods = this.names.get(name) ?? [];
    return signature ? methods.filter((method) => method.Signature === signature) : methods;
  }

  nextAddress(address: number): number | undefined {
    let left = 0,
      right = this.addresses.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (this.addresses[middle] <= address) left = middle + 1;
      else right = middle;
    }
    return this.addresses[left];
  }
}

export async function readMetadata(file: string): Promise<MethodMetadata> {
  const data = JSON.parse(await readFile(file, 'utf8'));
  return new MethodMetadata(data.ScriptMethod);
}
