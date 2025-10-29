import SpotifyWebApi from 'spotify-web-api-node';
import { config } from './config';
import { Track } from './musicService';
import { BaseMusicService } from './baseMusicService';
import { ErrorMessages, SPOTIFY_MAX_RETRY_ATTEMPTS } from './constants';

export class SpotifyService extends BaseMusicService {
  private spotifyApi: SpotifyWebApi;
  private refreshAttempts = 0;

  constructor() {
    super();
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
      this.refreshAttempts = 0;
    } catch (error) {
      throw new Error(`${ErrorMessages.AUTH_FAILED} (Spotify): ${error}`);
    }
  }

  async getCurrentTrack(): Promise<Track | null> {
    try {
      const data = await this.spotifyApi.getMyCurrentPlayingTrack();

      if (!data.body?.item) {
        return null;
      }

      if (!data.body.is_playing || data.body.item.type !== 'track') {
        return null;
      }

      const track = data.body.item as SpotifyApi.TrackObjectFull;

      return {
        name: track.name,
        artist: track.artists.map((artist: SpotifyApi.ArtistObjectSimplified) => artist.name).join(', '),
        album: track.album.name,
        isPlaying: true,
      };
    } catch (error: unknown) {
      if (this.isSpotifyError(error)) {
        if (error.statusCode === 401 && this.refreshAttempts < SPOTIFY_MAX_RETRY_ATTEMPTS) {
          this.refreshAttempts++;
          try {
            const refreshData = await this.spotifyApi.refreshAccessToken();
            this.spotifyApi.setAccessToken(refreshData.body.access_token);
            return await this.getCurrentTrack();
          } catch (refreshError) {
            this.refreshAttempts = 0;
            throw new Error(`Failed to refresh Spotify token: ${refreshError}`);
          }
        }

        if (error.statusCode === 204) {
          this.refreshAttempts = 0;
          return null;
        }
      }

      this.refreshAttempts = 0;
      throw error;
    }
  }

  private isSpotifyError(error: unknown): error is { statusCode: number } {
    return typeof error === 'object' && error !== null && 'statusCode' in error;
  }
}
