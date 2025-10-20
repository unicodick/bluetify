import SpotifyWebApi from 'spotify-web-api-node';
import { config } from './config';
import { MusicService, Track } from './musicService';

export class SpotifyService implements MusicService {
  private spotifyApi: SpotifyWebApi;
  private lastTrackId: string | null = null;

  constructor() {
    this.spotifyApi = new SpotifyWebApi({
      clientId: config.spotify!.clientId,
      clientSecret: config.spotify!.clientSecret,
      refreshToken: config.spotify!.refreshToken,
    });
  }

  async initialize(): Promise<void> {
    try {
      const data = await this.spotifyApi.refreshAccessToken();
      this.spotifyApi.setAccessToken(data.body.access_token);
    } catch (error) {
      throw new Error(`spotify auth failed: ${error}`);
    }
  }

  async getCurrentTrack(): Promise<Track | null> {
    try {
      const data = await this.spotifyApi.getMyCurrentPlayingTrack();

      if (!data.body?.item || !data.body.is_playing || data.body.item.type !== 'track') {
        return null;
      }

      const track = data.body.item as SpotifyApi.TrackObjectFull;

      return {
        name: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        isPlaying: true,
      };
    } catch (error: any) {
      if (error.statusCode === 401) {
        const refreshData = await this.spotifyApi.refreshAccessToken();
        this.spotifyApi.setAccessToken(refreshData.body.access_token);
        return await this.getCurrentTrack();
      }
      if (error.statusCode === 204) {
        return null;
      }
      throw error;
    }
  }

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
