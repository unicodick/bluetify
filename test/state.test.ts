import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ManagedBioState } from '../src/domain/index.js';
import { FileBioStateStore } from '../src/state/index.js';

const state: ManagedBioState = {
  version: 1,
  accountDid: 'did:plc:alice',
  originalDescription: 'original',
  lastWrittenDescription: 'managed',
  pendingDescription: null,
};

test('writes, loads, and clears state with owner-only permissions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bluetify-state-'));
  const filePath = join(directory, 'nested', 'state.json');
  try {
    const store = new FileBioStateStore(filePath);
    await store.save(state);
    assert.deepEqual(await store.load(), state);
    assert.equal((await stat(filePath)).mode & 0o777, 0o600);
    assert.match(await readFile(filePath, 'utf8'), /"version": 1/);

    await store.clear();
    assert.equal(await store.load(), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects invalid state schemas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bluetify-state-'));
  const filePath = join(directory, 'state.json');
  try {
    await writeFile(filePath, '{"version":2}', 'utf8');
    const store = new FileBioStateStore(filePath);
    await assert.rejects(store.load(), /invalid schema/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
