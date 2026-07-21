export interface Config {
  bluesky: {
    username: string;
    password: string;
  };
  lastfm: {
    apiKey: string;
    username: string;
  };
  stateFile: string;
  updateIntervalMs: number;
}
