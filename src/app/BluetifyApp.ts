import { Config } from '../config/index.js';
import {
  REQUEST_RETRY_ATTEMPTS,
  REQUEST_RETRY_BACKOFF_MS,
  SHUTDOWN_DEADLINE_MS,
  getRetryDelayMs,
  isTransientError,
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
  private lastTrackId: string | null | undefined;
  private isShuttingDown = false;
  private originalDescription: string | null = null;
  private lastWrittenDescription: string | null = null;
  private pendingDescription: string | null = null;
  private accountDid: string | null = null;
  private writesSuspended = false;
  private readonly lifecycleController = new AbortController();
  private activeTick: Promise<void> | null = null;
  private shutdownPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    const snapshot = await this.profile.initialize(this.lifecycleController.signal);
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
    await this.runTick();
    this.scheduleNextTick();
    logger.info(`polling every ${this.config.updateIntervalMs / 1000}s`, 'app');
  }

  shutdown(): Promise<void> {
    this.shutdownPromise ??= this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.lifecycleController.abort();

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    await this.activeTick;

    const shutdownController = new AbortController();
    const deadlineId = setTimeout(
      () => shutdownController.abort(new Error('shutdown deadline exceeded')),
      SHUTDOWN_DEADLINE_MS,
    );
    try {
      const restored = await this.restoreOriginalDescription(shutdownController.signal);
      logger.info(restored ? 'bio restored. bye.' : 'shutdown complete. bye.', 'app');
    } finally {
      clearTimeout(deadlineId);
    }
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      const track = await this.runWithTimeoutRetry('last.fm user.getrecenttracks', () =>
        getNowPlaying(this.config, this.lifecycleController.signal)
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
          () => this.restoreOriginalDescription(this.lifecycleController.signal),
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
        () => this.writeManagedDescription(bio, this.lifecycleController.signal),
      );
      if (!updated) {
        this.lastTrackId = trackId;
        return;
      }

      this.lastTrackId = trackId;
      logger.info(`now playing: ${track.name} - ${track.artist}`, 'app');
    } catch (error) {
      if (this.lifecycleController.signal.aborted) return;
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
      await this.runTick();
    } finally {
      this.scheduleNextTick();
    }
  }

  private async runTick(): Promise<void> {
    const tickPromise = this.tick();
    this.activeTick = tickPromise;
    try {
      await tickPromise;
    } finally {
      if (this.activeTick === tickPromise) {
        this.activeTick = null;
      }
    }
  }

  private async runWithTimeoutRetry<T>(
    operationLabel: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return retry(operation, {
      attempts: REQUEST_RETRY_ATTEMPTS,
      baseDelayMs: REQUEST_RETRY_BACKOFF_MS,
      shouldRetry: isTransientError,
      getDelayMs: (error, attempt) =>
        getRetryDelayMs(error, attempt, REQUEST_RETRY_BACKOFF_MS),
      signal: this.lifecycleController.signal,
      onRetry: (_error, attempt, delayMs) => {
        logger.warn(
          `${operationLabel} failed transiently (attempt ${attempt}/${REQUEST_RETRY_ATTEMPTS}), retrying in ${delayMs}ms`,
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

  private async restoreOriginalDescription(signal?: AbortSignal): Promise<boolean> {
    if (this.originalDescription === null || this.accountDid === null) {
      return false;
    }

    if (this.pendingDescription !== null) {
      const pendingResult = await this.profile.updateDescription(
        this.originalDescription,
        this.pendingDescription,
        signal,
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
      signal,
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

  private async writeManagedDescription(
    description: string,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const expected = this.lastWrittenDescription ?? this.getOriginalDescription();
    this.pendingDescription = description;
    await this.persistState();

    const result = await this.profile.updateDescription(description, expected, signal);
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
