import { SpotifyService } from './spotify';
import { BlueskyService } from './bluesky';
import { LastFmService } from './lastfm';
import { MusicService } from './musicService';
import { config } from './config';

class Bluetify {
  private musicService!: MusicService;
  private blueskyService: BlueskyService;
  private intervalId: NodeJS.Timeout | null = null;
  private originalBio: string = '';

  constructor() {
    this.blueskyService = new BlueskyService();

    const services = {
      spotify: SpotifyService,
      lastfm: LastFmService,
    };

    this.musicService = new services[config.musicService]();
  }

  async initialize(): Promise<void> {
    try {
      await this.musicService.initialize();
      await this.blueskyService.initialize();
      this.originalBio = await this.blueskyService.getCurrentDescription();
      console.log(`bluetify init with ${config.musicService}`);
    } catch (error) {
      console.error('failed to init:', error);
      throw error;
    }
  }

  async checkAndUpdateTrack(): Promise<void> {
    try {
      const currentTrack = await this.musicService.getCurrentTrack();

      if (!currentTrack) {
        if (this.musicService.hasTrackChanged(null)) {
          await this.blueskyService.restoreOriginalBio(this.originalBio);
        }
        return;
      }

      const trackChanged = this.musicService.hasTrackChanged(currentTrack);

      if (trackChanged) {
        const bioText = this.musicService.formatTrackForBio(currentTrack);
        await this.blueskyService.updateProfile(bioText);
        console.log(`Now playing: ${currentTrack.name} - ${currentTrack.artist}`);
      }
    } catch (error) {
      console.error('track check error:', error);
    }
  }

  start(): void {
    this.checkAndUpdateTrack();
    this.intervalId = setInterval(() => {
      this.checkAndUpdateTrack();
    }, config.updateInterval);
  }

  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    try {
      await this.blueskyService.restoreOriginalBio(this.originalBio);
      console.log('shutdown complete');
    } catch (error) {
      console.error('shutdown error:', error);
      throw error;
    }
  }
}

async function main() {
  const bluetify = new Bluetify();

  const gracefulShutdown = async () => {
    await bluetify.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  try {
    await bluetify.initialize();
    bluetify.start();
  } catch (error) {
    console.error('failed to start:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('unhandled error:', error);
  process.exit(1);
});
