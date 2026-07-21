import {
  Agent,
  AppBskyActorProfile,
  ComAtprotoRepoPutRecord,
  CredentialSession,
} from '@atproto/api';
import { Config } from '../../config/index.js';
import {
  BLUESKY_BIO_MAX_LENGTH,
  BLUESKY_SERVICE_URL,
  HTTP_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
} from '../../core/index.js';

const PROFILE_COLLECTION = 'app.bsky.actor.profile';
const PROFILE_RKEY = 'self';
const PROFILE_UPDATE_ATTEMPTS = 5;

interface ProfileRecord {
  cid: string;
  value: AppBskyActorProfile.Record;
}

export class BlueskyService {
  constructor(private readonly config: Config) {}

  private agent: Agent | null = null;
  private originalProfile: AppBskyActorProfile.Record | null = null;

  async initialize(): Promise<void> {
    const session = new CredentialSession(
      new URL(BLUESKY_SERVICE_URL),
      (input, init) => fetchWithTimeout(
        'bsky request',
        HTTP_REQUEST_TIMEOUT_MS,
        input,
        init,
      ),
    );
    await session.login({
      identifier: this.config.bluesky.username,
      password: this.config.bluesky.password,
    });

    this.agent = new Agent(session);
    this.originalProfile = (await this.fetchProfile()).value;
  }

  private getOriginalDescription(): string {
    return this.originalProfile?.description ?? '';
  }

  async updateDescription(description: string): Promise<void> {
    const truncated = description.length > BLUESKY_BIO_MAX_LENGTH
      ? description.slice(0, BLUESKY_BIO_MAX_LENGTH)
      : description;

    for (let attempt = 1; attempt <= PROFILE_UPDATE_ATTEMPTS; attempt += 1) {
      const current = await this.fetchProfile();

      try {
        const agent = this.getAgent();
        await agent.com.atproto.repo.putRecord({
          repo: agent.assertDid,
          collection: PROFILE_COLLECTION,
          rkey: PROFILE_RKEY,
          record: {
            ...current.value,
            $type: PROFILE_COLLECTION,
            description: truncated,
          },
          swapRecord: current.cid,
        });
        return;
      } catch (error) {
        if (
          error instanceof ComAtprotoRepoPutRecord.InvalidSwapError &&
          attempt < PROFILE_UPDATE_ATTEMPTS
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  async restoreOriginalDescription(): Promise<void> {
    await this.updateDescription(this.getOriginalDescription());
  }

  private async fetchProfile(): Promise<ProfileRecord> {
    const agent = this.getAgent();
    const response = await agent.com.atproto.repo.getRecord({
      repo: agent.assertDid,
      collection: PROFILE_COLLECTION,
      rkey: PROFILE_RKEY,
    });
    const cid = response.data.cid;
    if (!cid) {
      throw new Error('bsky profile response is missing cid');
    }

    const result = AppBskyActorProfile.validateRecord(response.data.value);
    if (!result.success) {
      throw new Error(`bsky profile record is invalid: ${result.error.message}`);
    }

    return { cid, value: result.value };
  }

  private getAgent(): Agent {
    if (!this.agent) {
      throw new Error('bsky session not initialized');
    }
    return this.agent;
  }
}
