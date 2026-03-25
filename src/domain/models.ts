export interface Track {
  name: string;
  artist: string;
}

export interface BlueskyProfile {
  displayName?: string;
  description?: string;
  avatar?: { ref: { $link: string }; mimeType: string };
  banner?: { ref: { $link: string }; mimeType: string };
  [k: string]: unknown;
}
