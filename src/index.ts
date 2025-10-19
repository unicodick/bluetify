import { SpotifyService } from './spotify';
import { BlueskyService } from './bluesky';
import { config } from './config';

class Bluetify {
  private spotifyService: SpotifyService;
  private blueskyService: BlueskyService;
  private intervalId: NodeJS.Timeout | null = null;
  private originalBio: string = '';

  constructor() {
    this.spotifyService = new SpotifyService();
    this.blueskyService = new BlueskyService();
  }

  async initialize(): Promise<void> {
    try {
      await this.spotifyService.initialize();
      await this.blueskyService.initialize();
      this.originalBio = await this.blueskyService.getCurrentDescription();
      console.log('bluetify init ~ github.com/unicodick/bluetify');
    } catch (error) {
      console.error('failed to init:', error);
      throw error;
    }
  }

  async checkAndUpdateTrack(): Promise<void> {
    try {
      const currentTrack = await this.spotifyService.getCurrentTrack();

      if (!currentTrack) {
        if (this.spotifyService.hasTrackChanged(null)) {
          await this.blueskyService.restoreOriginalBio(this.originalBio);
        }
        return;
      }

      if (this.spotifyService.hasTrackChanged(currentTrack)) {
        const bioText = this.spotifyService.formatTrackForBio(currentTrack);
        console.log(`${currentTrack.name} - ${currentTrack.artist}`);
        await this.blueskyService.updateProfile(bioText);
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
