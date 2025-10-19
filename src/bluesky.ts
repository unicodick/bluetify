import { BskyAgent } from '@atproto/api';
import { config } from './config';

export class BlueskyService {
  private agent: BskyAgent;

  constructor() {
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
  }

  async initialize(): Promise<void> {
    try {
      await this.agent.login({
        identifier: config.bluesky.username,
        password: config.bluesky.password,
      });
    } catch (error) {
      throw new Error(`bluesky auth failed: ${error}`);
    }
  }

  async updateProfile(newDescription: string): Promise<void> {
    const profileResponse = await this.agent.getProfile({
      actor: config.bluesky.username,
    });

    const currentProfile = profileResponse.data;

    await this.agent.upsertProfile((existing) => ({
      ...existing,
      displayName: currentProfile.displayName || '',
      description: newDescription,
    }));
  }

  async getCurrentDescription(): Promise<string> {
    const profileResponse = await this.agent.getProfile({
      actor: config.bluesky.username,
    });

    return profileResponse.data.description || '';
  }

  async restoreOriginalBio(originalBio: string): Promise<void> {
    try {
      await this.updateProfile(originalBio);
    } catch (error) {
      console.error('failed to restore original bio:', error);
    }
  }
}
