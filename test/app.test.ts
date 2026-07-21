import assert from 'node:assert/strict';
import test from 'node:test';
import { BluetifyApp } from '../src/app/index.js';
import { Config } from '../src/config/index.js';
import {
  BioStateStore,
  ManagedBioState,
  ProfileService,
  ProfileSnapshot,
  ProfileUpdateResult,
  Track,
} from '../src/domain/index.js';

const config: Config = {
  bluesky: {
    username: 'alice.test',
    password: 'app-password',
    serviceUrl: 'https://bsky.social',
  },
  lastfm: { apiKey: 'key', username: 'alice' },
  stateFile: '.state.json',
  updateIntervalMs: 10_000,
};

test('updates and restores a managed bio', async () => {
  const profile = new FakeProfile('original bio');
  const state = new MemoryStateStore();
  const app = createApp(profile, state, { name: 'Song', artist: 'Artist' });

  await app.initialize();
  await app.start();
  assert.equal(profile.description, '🎵 Song by Artist');

  await app.shutdown();
  assert.equal(profile.description, 'original bio');
  assert.equal(state.value, null);
  assert.deepEqual(profile.writes, ['🎵 Song by Artist', 'original bio']);
});

test('preserves an external edit and suspends writes', async () => {
  const profile = new FakeProfile('original bio');
  const state = new MemoryStateStore();
  const app = new BluetifyApp(config, profile, state, async () => {
    profile.description = 'manual bio';
    return { name: 'Song', artist: 'Artist' };
  });

  await app.initialize();
  await app.start();
  await app.shutdown();

  assert.equal(profile.description, 'manual bio');
  assert.deepEqual(profile.writes, []);
  assert.equal(state.value, null);
});

test('does not overwrite an external edit during shutdown', async () => {
  const profile = new FakeProfile('original bio');
  const state = new MemoryStateStore();
  const app = createApp(profile, state, { name: 'Song', artist: 'Artist' });

  await app.initialize();
  await app.start();
  profile.description = 'manual bio';
  await app.shutdown();

  assert.equal(profile.description, 'manual bio');
  assert.deepEqual(profile.writes, ['🎵 Song by Artist']);
});

test('restores a managed bio recovered after a crash', async () => {
  const managedDescription = '🎵 Song by Artist';
  const profile = new FakeProfile(managedDescription);
  const state = new MemoryStateStore({
    version: 1,
    accountDid: profile.accountDid,
    originalDescription: 'original bio',
    lastWrittenDescription: managedDescription,
    pendingDescription: null,
  });
  const app = createApp(profile, state, null);

  await app.initialize();
  await app.start();

  assert.equal(profile.description, 'original bio');
  assert.equal(state.value, null);
  await app.shutdown();
});

test('recovers a write that completed before its response was lost', async () => {
  const pendingDescription = '🎵 Pending by Artist';
  const profile = new FakeProfile(pendingDescription);
  const state = new MemoryStateStore({
    version: 1,
    accountDid: profile.accountDid,
    originalDescription: 'original bio',
    lastWrittenDescription: null,
    pendingDescription,
  });
  const app = createApp(profile, state, null);

  await app.initialize();
  await app.start();

  assert.equal(profile.description, 'original bio');
  assert.equal(state.value, null);
  await app.shutdown();
});

test('serializes repeated shutdown calls', async () => {
  const profile = new FakeProfile('original bio');
  const state = new MemoryStateStore();
  const app = createApp(profile, state, { name: 'Song', artist: 'Artist' });

  await app.initialize();
  await app.start();
  await Promise.all([app.shutdown(), app.shutdown(), app.shutdown()]);

  assert.deepEqual(profile.writes, ['🎵 Song by Artist', 'original bio']);
});

function createApp(
  profile: FakeProfile,
  state: MemoryStateStore,
  track: Track | null,
): BluetifyApp {
  return new BluetifyApp(config, profile, state, async () => track);
}

class FakeProfile implements ProfileService {
  readonly accountDid = 'did:plc:alice';
  readonly writes: string[] = [];

  constructor(public description: string) {}

  async initialize(signal?: AbortSignal): Promise<ProfileSnapshot> {
    signal?.throwIfAborted();
    return { accountDid: this.accountDid, description: this.description };
  }

  async updateDescription(
    description: string,
    expectedDescription: string,
    signal?: AbortSignal,
  ): Promise<ProfileUpdateResult> {
    signal?.throwIfAborted();
    if (this.description !== expectedDescription) {
      return { status: 'conflict', description: this.description };
    }
    this.description = description;
    this.writes.push(description);
    return { status: 'updated', description };
  }
}

class MemoryStateStore implements BioStateStore {
  value: ManagedBioState | null;

  constructor(value: ManagedBioState | null = null) {
    this.value = value;
  }

  async load(): Promise<ManagedBioState | null> {
    return this.value ? structuredClone(this.value) : null;
  }

  async save(state: ManagedBioState): Promise<void> {
    this.value = structuredClone(state);
  }

  async clear(): Promise<void> {
    this.value = null;
  }
}
