import { BlueskyService } from './bluesky.js';
import { Config, loadConfig } from './config.js';
import { getNowPlaying } from './lastfm.js';
import { Track } from './types.js';

export class BluetifyApp {
  private bluesky: BlueskyService | null = null;
  private config: Config | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private lastTrackId: string | null = null;
  private isShuttingDown = false;

  async initialize(): Promise<void> {
    this.config = loadConfig();
    this.bluesky = new BlueskyService(this.config);
    await this.bluesky.initialize();
    console.log('[bluetify] init. original bio saved.');
  }

  async start(): Promise<void> {
    if (!this.config) {
      throw new Error('app config not init');
    }

    await this.tick();
    this.scheduleNextTick();
    console.log(`[bluetify] polling every ${this.config.updateIntervalMs / 1000}s`);
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (!this.bluesky) return;

    await this.bluesky.restoreOriginalDescription();
    console.log('[bluetify] bio restored. bye.');
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;
    if (!this.config || !this.bluesky) {
      throw new Error('app not init');
    }

    try {
      const track = await getNowPlaying(this.config);
      const trackId = getTrackId(track);

      if (trackId === this.lastTrackId) return;
      this.lastTrackId = trackId;

      if (!track) {
        await this.bluesky.restoreOriginalDescription();
        console.log('[bluetify] nothing playing - bio restored.');
        return;
      }

      const bio = formatBio(track);
      await this.bluesky.updateDescription(bio);
      console.log(`[bluetify] now playing: ${track.name} - ${track.artist}`);
    } catch (error) {
      console.error('[bluetify] tick error:', error instanceof Error ? error.message : error);
    }
  }

  private scheduleNextTick(): void {
    if (this.isShuttingDown) return;
    if (!this.config) {
      throw new Error('app config not init');
    }

    this.timeoutId = setTimeout(() => {
      void this.runScheduledTick();
    }, this.config.updateIntervalMs);
  }

  private async runScheduledTick(): Promise<void> {
    try {
      await this.tick();
    } finally {
      this.scheduleNextTick();
    }
  }
}

function getTrackId(track: Track | null): string | null {
  return track ? `${track.artist}|${track.name}` : null;
}

function formatBio(track: Track): string {
  return `🎵 ${track.name} by ${track.artist}`;
}
