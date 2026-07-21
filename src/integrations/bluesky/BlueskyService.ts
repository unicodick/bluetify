import {
  Agent,
  AppBskyActorProfile,
  ComAtprotoRepoPutRecord,
  CredentialSession,
} from '@atproto/api';
import { Config } from '../../config/index.js';
import {
  BLUESKY_SERVICE_URL,
  HTTP_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  truncateBlueskyDescription,
} from '../../core/index.js';
import {
  ProfileService,
  ProfileSnapshot,
  ProfileUpdateResult,
} from '../../domain/index.js';

const PROFILE_COLLECTION = 'app.bsky.actor.profile';
const PROFILE_RKEY = 'self';
const PROFILE_UPDATE_ATTEMPTS = 5;

interface ProfileRecord {
  cid: string;
  value: AppBskyActorProfile.Record;
}

export class BlueskyService implements ProfileService {
  constructor(private readonly config: Config) {}

  private agent: Agent | null = null;

  async initialize(signal?: AbortSignal): Promise<ProfileSnapshot> {
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
    const profile = await this.fetchProfile(signal);
    return { description: profile.value.description ?? '' };
  }

  async updateDescription(
    description: string,
    expectedDescription: string,
    signal?: AbortSignal,
  ): Promise<ProfileUpdateResult> {
    const truncated = truncateBlueskyDescription(description);

    for (let attempt = 1; attempt <= PROFILE_UPDATE_ATTEMPTS; attempt += 1) {
      const current = await this.fetchProfile(signal);
      const currentDescription = current.value.description ?? '';
      if (currentDescription !== expectedDescription) {
        return { status: 'conflict', description: currentDescription };
      }

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
        }, { signal });
        return { status: 'updated', description: truncated };
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

    throw new Error('bsky profile update attempts exhausted');
  }

  private async fetchProfile(signal?: AbortSignal): Promise<ProfileRecord> {
    const agent = this.getAgent();
    const response = await agent.com.atproto.repo.getRecord({
      repo: agent.assertDid,
      collection: PROFILE_COLLECTION,
      rkey: PROFILE_RKEY,
    }, { signal });
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
