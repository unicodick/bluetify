import { BskyAgent, AppBskyActorProfile } from '@atproto/api';
import { config } from './config';
import { BLUESKY_SERVICE_URL, BLUESKY_BIO_MAX_LENGTH, ErrorMessages } from './constants';

export class BlueskyService {
  private agent: BskyAgent;

  constructor() {
    this.agent = new BskyAgent({ service: BLUESKY_SERVICE_URL });
  }

  async initialize(): Promise<void> {
    try {
      await this.agent.login({
        identifier: config.bluesky.username,
        password: config.bluesky.password,
      });
    } catch (error) {
      throw new Error(`${ErrorMessages.AUTH_FAILED} (Bluesky): ${error}`);
    }
  }

  async updateProfile(newDescription: string): Promise<void> {
    try {
      const validatedDescription = this.validateBioLength(newDescription);

      await this.agent.upsertProfile((existing: AppBskyActorProfile.Record | undefined) => {
        return {
          displayName: existing?.displayName ?? '',
          description: validatedDescription,
          avatar: existing?.avatar,
          banner: existing?.banner,
        };
      });
    } catch (error) {
      throw new Error(`${ErrorMessages.PROFILE_UPDATE_FAILED}: ${error}`);
    }
  }

  async getCurrentDescription(): Promise<string> {
    try {
      const profileResponse = await this.agent.getProfile({
        actor: config.bluesky.username,
      });

      return profileResponse.data.description || '';
    } catch (error) {
      throw new Error(`Failed to fetch profile description: ${error}`);
    }
  }

  async restoreOriginalBio(originalBio: string): Promise<void> {
    try {
      await this.updateProfile(originalBio);
    } catch (error) {
      throw new Error(`${ErrorMessages.BIO_RESTORE_FAILED}: ${error}`);
    }
  }

  private validateBioLength(bio: string): string {
    if (bio.length > BLUESKY_BIO_MAX_LENGTH) {
      console.warn(`Bio exceeds ${BLUESKY_BIO_MAX_LENGTH} characters, truncating...`);
      return bio.substring(0, BLUESKY_BIO_MAX_LENGTH);
    }
    return bio;
  }
}
