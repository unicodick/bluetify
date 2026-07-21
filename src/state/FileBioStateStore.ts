import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { BioStateStore, ManagedBioState } from '../domain/index.js';

export class FileBioStateStore implements BioStateStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  async load(): Promise<ManagedBioState | null> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(`state file contains invalid JSON: ${this.filePath}`, { cause: error });
    }

    if (!isManagedBioState(data)) {
      throw new Error(`state file has an invalid schema: ${this.filePath}`);
    }
    return data;
  }

  async save(state: ManagedBioState): Promise<void> {
    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true });

    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      await rename(temporaryPath, this.filePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

function isManagedBioState(value: unknown): value is ManagedBioState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<ManagedBioState>;
  return (
    state.version === 1 &&
    typeof state.accountDid === 'string' &&
    typeof state.originalDescription === 'string' &&
    isNullableString(state.lastWrittenDescription) &&
    isNullableString(state.pendingDescription)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
