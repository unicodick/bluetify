import { BlueskyService } from './bluesky.js';
import { config } from './config.js';
import { getNowPlaying } from './lastfm.js';
import { Track } from './types.js';

export class BluetifyApp {
  private readonly bluesky = new BlueskyService();
  private intervalId: NodeJS.Timeout | null = null;
  private lastTrackId: string | null = null;
  private isShuttingDown = false;

  async initialize(): Promise<void> {
    await this.bluesky.initialize();
    console.log('[bluetify] init. original bio saved.');
  }

  async start(): Promise<void> {
    await this.tick();
    this.intervalId = setInterval(() => void this.tick(), config.updateIntervalMs);
    console.log(`[bluetify] polling every ${config.updateIntervalMs / 1000}s`);
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.bluesky.restoreOriginalDescription();
    console.log('[bluetify] bio restored. bye.');
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      const track = await getNowPlaying();
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
}

function getTrackId(track: Track | null): string | null {
  return track ? `${track.artist}|${track.name}` : null;
}

function formatBio(track: Track): string {
  return `🎵 ${track.name} by ${track.artist}`;
}
