import { Config } from '../config/index.js';
import {
  RequestTimeoutError,
  TIMEOUT_RETRY_ATTEMPTS,
  TIMEOUT_RETRY_BACKOFF_MS,
  logger,
  retry,
} from '../core/index.js';
import { getNowPlaying } from '../integrations/lastfm/index.js';
import { BlueskyService } from '../integrations/bluesky/index.js';
import { Track } from '../domain/index.js';

export class BluetifyApp {
  constructor(
    private readonly config: Config,
    private readonly bluesky: BlueskyService,
  ) {}

  private timeoutId: NodeJS.Timeout | null = null;
  private lastTrackId: string | null = null;
  private isShuttingDown = false;

  async initialize(): Promise<void> {
    await this.bluesky.initialize();
    logger.info('init. original bio saved.', 'app');
  }

  async start(): Promise<void> {
    await this.tick();
    this.scheduleNextTick();
    logger.info(`polling every ${this.config.updateIntervalMs / 1000}s`, 'app');
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    await this.bluesky.restoreOriginalDescription();
    logger.info('bio restored. bye.', 'app');
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      const track = await this.runWithTimeoutRetry('last.fm user.getrecenttracks', () =>
        getNowPlaying(this.config)
      );
      const trackId = getTrackId(track);

      if (trackId === this.lastTrackId) return;

      if (!track) {
        await this.runWithTimeoutRetry('bsky restore description', () =>
          this.bluesky.restoreOriginalDescription()
        );
        this.lastTrackId = null;
        logger.info('nothing playing - bio restored.', 'app');
        return;
      }

      const bio = formatBio(track);
      await this.runWithTimeoutRetry('bsky update description', () =>
        this.bluesky.updateDescription(bio)
      );
      this.lastTrackId = trackId;
      logger.info(`now playing: ${track.name} - ${track.artist}`, 'app');
    } catch (error) {
      logger.error('tick error:', error, 'app');
    }
  }

  private scheduleNextTick(): void {
    if (this.isShuttingDown) return;

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

  private async runWithTimeoutRetry<T>(
    operationLabel: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return retry(operation, {
      attempts: TIMEOUT_RETRY_ATTEMPTS,
      baseDelayMs: TIMEOUT_RETRY_BACKOFF_MS,
      shouldRetry: (error) => error instanceof RequestTimeoutError,
      onRetry: (_error, attempt, delayMs) => {
        logger.warn(
          `${operationLabel} timeout (attempt ${attempt}/${TIMEOUT_RETRY_ATTEMPTS}), retrying in ${delayMs}ms`,
          'app',
        );
      },
    });
  }
}

function getTrackId(track: Track | null): string | null {
  return track ? `${track.artist}|${track.name}` : null;
}

function formatBio(track: Track): string {
  return `🎵 ${track.name} by ${track.artist}`;
}
