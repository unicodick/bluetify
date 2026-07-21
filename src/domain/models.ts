export interface Track {
  name: string;
  artist: string;
}

export interface ProfileSnapshot {
  description: string;
}

export type ProfileUpdateResult =
  | { status: 'updated'; description: string }
  | { status: 'conflict'; description: string };

export interface ProfileService {
  initialize(signal?: AbortSignal): Promise<ProfileSnapshot>;
  updateDescription(
    description: string,
    expectedDescription: string,
    signal?: AbortSignal,
  ): Promise<ProfileUpdateResult>;
}
