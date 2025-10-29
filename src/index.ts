import { SpotifyService } from './spotify';
import { BlueskyService } from './bluesky';
import { LastFmService } from './lastfm';
import { MusicService } from './musicService';
import { config } from './config';
import { ErrorMessages, LogMessages } from './constants';

class Bluetify {
  private musicService: MusicService;
  private blueskyService: BlueskyService;
  private intervalId: NodeJS.Timeout | null = null;
  private originalBio: string = '';
  private isShuttingDown: boolean = false;

  constructor() {
    this.blueskyService = new BlueskyService();

    const services = {
      spotify: SpotifyService,
      lastfm: LastFmService,
    };

    const ServiceClass = services[config.musicService];
    this.musicService = new ServiceClass();
  }

  async initialize(): Promise<void> {
    try {
      await this.musicService.initialize();
      await this.blueskyService.initialize();
      this.originalBio = await this.blueskyService.getCurrentDescription();
      console.log(LogMessages.INIT_SUCCESS(config.musicService));
    } catch (error) {
      console.error(`${ErrorMessages.INIT_FAILED}:`, error);
      throw error;
    }
  }

  async checkAndUpdateTrack(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

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
        console.log(LogMessages.NOW_PLAYING(currentTrack.name, currentTrack.artist));
      }
    } catch (error) {
      console.error(`${ErrorMessages.TRACK_CHECK_FAILED}:`, error);
    }
  }

  async start(): Promise<void> {
    await this.checkAndUpdateTrack();
    this.intervalId = setInterval(() => {
      void this.checkAndUpdateTrack();
    }, config.updateInterval);
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    try {
      await this.blueskyService.restoreOriginalBio(this.originalBio);
      console.log(LogMessages.SHUTDOWN_COMPLETE);
    } catch (error) {
      console.error(`${ErrorMessages.SHUTDOWN_FAILED}:`, error);
      throw error;
    }
  }
}

async function main(): Promise<void> {
  const bluetify = new Bluetify();

  const gracefulShutdown = async (signal: string): Promise<void> => {
    try {
      await bluetify.shutdown();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

  try {
    await bluetify.initialize();
    await bluetify.start();
  } catch (error) {
    console.error('Failed to start Bluetify:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
