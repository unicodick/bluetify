import { config } from './config.js';
import {
  BLUESKY_SERVICE_URL,
  BLUESKY_BIO_MAX_LENGTH,
  HTTP_REQUEST_TIMEOUT_MS,
} from './constants.js';
import { fetchWithTimeout } from './http.js';
import { BlueskyProfile } from './types.js';

interface AtpSession {
  accessJwt: string;
  did: string;
}

interface AtpGetRecordResponse {
  value: BlueskyProfile;
  cid: string;
}

interface AtpError {
  error: string;
  message: string;
}

function parseJsonOrNull<T>(rawBody: string): T | null {
  const trimmed = rawBody.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

async function atpFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BLUESKY_SERVICE_URL}/xrpc/${endpoint}`;
  const response = await fetchWithTimeout(
    `bsky request [${endpoint}]`,
    HTTP_REQUEST_TIMEOUT_MS,
    url,
    {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    },
  );

  const rawBody = await response.text();

  if (!response.ok) {
    const err = parseJsonOrNull<AtpError>(rawBody);

    if (err?.error && err?.message) {
      throw new Error(`bsky API error [${endpoint}]: ${err.error} - ${err.message}`);
    }

    const fallbackBody = rawBody.trim().slice(0, 300) || '<empty body>';
    throw new Error(
      `bsky API error [${endpoint}]: HTTP ${response.status} ${response.statusText}. body: ${fallbackBody}`,
    );
  }

  const data = parseJsonOrNull<T>(rawBody);
  if (data === null) {
    throw new Error(
      `bsky API error [${endpoint}]: invalid JSON response (HTTP ${response.status})`,
    );
  }

  return data;
}

export class BlueskyService {
  private session: AtpSession | null = null;
  private originalProfile: BlueskyProfile | null = null;

  async initialize(): Promise<void> {
    this.session = await atpFetch<AtpSession>('com.atproto.server.createSession', {
      method: 'POST',
      body: JSON.stringify({
        identifier: config.bluesky.username,
        password: config.bluesky.password,
      }),
    });

    this.originalProfile = await this.fetchProfile();
  }

  getOriginalDescription(): string {
    return this.originalProfile?.description ?? '';
  }

  async updateDescription(description: string): Promise<void> {
    if (!this.session) {
      throw new Error('bsky session not init');
    }

    const truncated = description.length > BLUESKY_BIO_MAX_LENGTH
      ? description.slice(0, BLUESKY_BIO_MAX_LENGTH)
      : description;

    const current = await this.fetchProfile();

    await atpFetch('com.atproto.repo.putRecord', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.session.accessJwt}` },
      body: JSON.stringify({
        repo: this.session.did,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: {
          ...current,
          $type: 'app.bsky.actor.profile',
          description: truncated,
        },
      }),
    });
  }

  async restoreOriginalDescription(): Promise<void> {
    await this.updateDescription(this.getOriginalDescription());
  }

  private async fetchProfile(): Promise<BlueskyProfile> {
    if (!this.session) {
      throw new Error('bsky session not init');
    }

    const data = await atpFetch<AtpGetRecordResponse>(
      `com.atproto.repo.getRecord?repo=${encodeURIComponent(this.session.did)}&collection=app.bsky.actor.profile&rkey=self`,
    );

    return data.value;
  }
}
