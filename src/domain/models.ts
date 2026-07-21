export interface Track {
  name: string;
  artist: string;
}

export interface ProfileSnapshot {
  accountDid: string;
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

export interface ManagedBioState {
  version: 1;
  accountDid: string;
  originalDescription: string;
  lastWrittenDescription: string | null;
  pendingDescription: string | null;
}

export interface BioStateStore {
  load(): Promise<ManagedBioState | null>;
  save(state: ManagedBioState): Promise<void>;
  clear(): Promise<void>;
}
