import { Config } from '../config/index.js';
import {
  RequestTimeoutError,
  TIMEOUT_RETRY_ATTEMPTS,
  TIMEOUT_RETRY_BACKOFF_MS,
  logger,
  retry,
} from '../core/index.js';
import { getNowPlaying } from '../integrations/lastfm/index.js';
import { ProfileService, Track } from '../domain/index.js';

export class BluetifyApp {
  constructor(
    private readonly config: Config,
    private readonly profile: ProfileService,
  ) {}

  private timeoutId: NodeJS.Timeout | null = null;
  private lastTrackId: string | null = null;
  private isShuttingDown = false;
  private originalDescription: string | null = null;
  private lastWrittenDescription: string | null = null;
  private writesSuspended = false;

  async initialize(): Promise<void> {
    const snapshot = await this.profile.initialize();
    this.originalDescription = snapshot.description;
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

    const restored = await this.restoreOriginalDescription();
    logger.info(restored ? 'bio restored. bye.' : 'shutdown complete. bye.', 'app');
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      const track = await this.runWithTimeoutRetry('last.fm user.getrecenttracks', () =>
        getNowPlaying(this.config)
      );
      const trackId = getTrackId(track);

      if (trackId === this.lastTrackId) return;

      if (this.writesSuspended) {
        this.lastTrackId = trackId;
        return;
      }

      if (!track) {
        const restored = await this.runWithTimeoutRetry(
          'bsky restore description',
          () => this.restoreOriginalDescription(),
        );
        this.lastTrackId = null;
        if (restored) {
          logger.info('nothing playing - bio restored.', 'app');
        }
        return;
      }

      const bio = formatBio(track);
      const expected = this.lastWrittenDescription ?? this.getOriginalDescription();
      const result = await this.runWithTimeoutRetry(
        'bsky update description',
        () => this.profile.updateDescription(bio, expected),
      );
      if (result.status === 'conflict') {
        this.suspendWrites(result.description);
        this.lastTrackId = trackId;
        return;
      }

      this.lastWrittenDescription = result.description;
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

  private getOriginalDescription(): string {
    if (this.originalDescription === null) {
      throw new Error('original bio is not initialized');
    }
    return this.originalDescription;
  }

  private async restoreOriginalDescription(): Promise<boolean> {
    if (this.lastWrittenDescription === null || this.originalDescription === null) {
      return false;
    }

    const result = await this.profile.updateDescription(
      this.originalDescription,
      this.lastWrittenDescription,
    );
    if (result.status === 'conflict') {
      this.suspendWrites(result.description);
      return false;
    }

    this.lastWrittenDescription = null;
    return true;
  }

  private suspendWrites(currentDescription: string): void {
    this.writesSuspended = true;
    this.lastWrittenDescription = null;
    logger.warn(
      `bio changed outside bluetify; writes suspended until restart (current length: ${currentDescription.length})`,
      'app',
    );
  }
}

function getTrackId(track: Track | null): string | null {
  return track ? `${track.artist}|${track.name}` : null;
}

function formatBio(track: Track): string {
  return `🎵 ${track.name} by ${track.artist}`;
}
