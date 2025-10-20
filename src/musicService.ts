export interface Track {
  name: string;
  artist: string;
  album: string;
  isPlaying: boolean;
}

export interface MusicService {
  initialize(): Promise<void>;
  getCurrentTrack(): Promise<Track | null>;
  hasTrackChanged(track: Track | null): boolean;
  formatTrackForBio(track: Track): string;
}
