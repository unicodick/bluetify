import { MusicService, Track } from './musicService';

export abstract class BaseMusicService implements MusicService {
  protected lastTrackId: string | null = null;

  abstract initialize(): Promise<void>;
  abstract getCurrentTrack(): Promise<Track | null>;

  hasTrackChanged(currentTrack: Track | null): boolean {
    const trackId = currentTrack ? `${currentTrack.name}|${currentTrack.artist}` : null;
    const changed = this.lastTrackId !== trackId;
    this.lastTrackId = trackId;
    return changed;
  }

  formatTrackForBio(track: Track): string {
    return `Now playing: ${track.name} by ${track.artist}`;
  }
}
