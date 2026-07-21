import { Config } from '../config/index.js';
import {
  RequestTimeoutError,
  TIMEOUT_RETRY_ATTEMPTS,
  TIMEOUT_RETRY_BACKOFF_MS,
  logger,
  retry,
  truncateBlueskyDescription,
} from '../core/index.js';
import { getNowPlaying } from '../integrations/lastfm/index.js';
import {
  BioStateStore,
  ManagedBioState,
  ProfileService,
  ProfileSnapshot,
  Track,
} from '../domain/index.js';

export class BluetifyApp {
  constructor(
    private readonly config: Config,
    private readonly profile: ProfileService,
    private readonly stateStore: BioStateStore,
  ) {}

  private timeoutId: NodeJS.Timeout | null = null;
  private lastTrackId: string | null = null;
  private isShuttingDown = false;
  private originalDescription: string | null = null;
  private lastWrittenDescription: string | null = null;
  private pendingDescription: string | null = null;
  private accountDid: string | null = null;
  private writesSuspended = false;

  async initialize(): Promise<void> {
    const snapshot = await this.profile.initialize();
    const recovered = await this.recoverState(snapshot);
    this.accountDid = snapshot.accountDid;
    this.originalDescription = recovered.originalDescription;
    this.lastWrittenDescription = recovered.lastWrittenDescription;
    this.pendingDescription = null;
    await this.persistState();
    logger.info(
      recovered.lastWrittenDescription === null
        ? 'init. original bio saved.'
        : 'init. managed bio recovered.',
      'app',
    );
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

      if (
        trackId === this.lastTrackId &&
        this.lastWrittenDescription === null &&
        this.pendingDescription === null
      ) return;

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
      const updated = await this.runWithTimeoutRetry(
        'bsky update description',
        () => this.writeManagedDescription(bio),
      );
      if (!updated) {
        this.lastTrackId = trackId;
        return;
      }

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
    if (this.originalDescription === null || this.accountDid === null) {
      return false;
    }

    if (this.pendingDescription !== null) {
      const pendingResult = await this.profile.updateDescription(
        this.originalDescription,
        this.pendingDescription,
      );
      if (pendingResult.status === 'updated' || pendingResult.description === this.originalDescription) {
        await this.clearState();
        return true;
      }

      const previousDescription = this.lastWrittenDescription ?? this.originalDescription;
      if (pendingResult.description !== previousDescription) {
        await this.suspendWrites(pendingResult.description);
        return false;
      }

      this.pendingDescription = null;
      await this.persistState();
    }

    if (this.lastWrittenDescription === null) {
      await this.clearState();
      return false;
    }

    const result = await this.profile.updateDescription(
      this.originalDescription,
      this.lastWrittenDescription,
    );
    if (result.status === 'conflict') {
      if (result.description === this.originalDescription) {
        await this.clearState();
        return true;
      }
      await this.suspendWrites(result.description);
      return false;
    }

    await this.clearState();
    return true;
  }

  private async writeManagedDescription(description: string): Promise<boolean> {
    const expected = this.lastWrittenDescription ?? this.getOriginalDescription();
    this.pendingDescription = description;
    await this.persistState();

    const result = await this.profile.updateDescription(description, expected);
    if (result.status === 'conflict' && result.description !== description) {
      await this.suspendWrites(result.description);
      return false;
    }

    this.lastWrittenDescription = description;
    this.pendingDescription = null;
    await this.persistState();
    return true;
  }

  private async recoverState(snapshot: ProfileSnapshot): Promise<ManagedBioState> {
    const saved = await this.stateStore.load();
    if (!saved || saved.accountDid !== snapshot.accountDid) {
      return createState(snapshot.accountDid, snapshot.description);
    }

    const previousDescription = saved.lastWrittenDescription ?? saved.originalDescription;
    if (saved.pendingDescription !== null) {
      if (snapshot.description === saved.pendingDescription) {
        return {
          ...saved,
          lastWrittenDescription: saved.pendingDescription,
          pendingDescription: null,
        };
      }
      if (snapshot.description !== previousDescription) {
        return createState(snapshot.accountDid, snapshot.description);
      }
    }

    if (
      saved.lastWrittenDescription !== null &&
      snapshot.description === saved.lastWrittenDescription
    ) {
      return { ...saved, pendingDescription: null };
    }

    return createState(snapshot.accountDid, snapshot.description);
  }

  private async persistState(): Promise<void> {
    if (this.accountDid === null || this.originalDescription === null) {
      throw new Error('managed bio state is not initialized');
    }
    await this.stateStore.save({
      version: 1,
      accountDid: this.accountDid,
      originalDescription: this.originalDescription,
      lastWrittenDescription: this.lastWrittenDescription,
      pendingDescription: this.pendingDescription,
    });
  }

  private async clearState(): Promise<void> {
    await this.stateStore.clear();
    this.lastWrittenDescription = null;
    this.pendingDescription = null;
  }

  private async suspendWrites(currentDescription: string): Promise<void> {
    this.writesSuspended = true;
    await this.clearState();
    logger.warn(
      `bio changed outside bluetify; writes suspended until restart (current length: ${currentDescription.length})`,
      'app',
    );
  }
}

function createState(accountDid: string, originalDescription: string): ManagedBioState {
  return {
    version: 1,
    accountDid,
    originalDescription,
    lastWrittenDescription: null,
    pendingDescription: null,
  };
}

function getTrackId(track: Track | null): string | null {
  return track ? `${track.artist}|${track.name}` : null;
}

function formatBio(track: Track): string {
  return truncateBlueskyDescription(`🎵 ${track.name} by ${track.artist}`);
}
