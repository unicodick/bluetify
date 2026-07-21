# bluetify

Bluetify updates your [Bluesky](https://bsky.app) bio with the track currently
playing on [Last.fm](https://last.fm). When playback stops, it restores the bio
that was present before Bluetify took control.

## Requirements

- Node.js 22 or newer, or Docker
- A [Last.fm API key](https://www.last.fm/api/account/create)
- A Bluesky [App Password](https://bsky.app/settings/app-passwords)

Use an App Password, never your main Bluesky password.

## Run locally

```sh
git clone https://github.com/unicodick/bluetify.git
cd bluetify
cp .env.example .env
npm ci
npm run build
npm start
```

For development with automatic restarts:

```sh
npm run dev
```

## Configuration

| Variable | Required | Default | Description |
|---|---:|---|---|
| `LASTFM_API_KEY` | yes | — | Last.fm API key |
| `LASTFM_USERNAME` | yes | — | Last.fm username to poll |
| `BSKY_USERNAME` | yes | — | Bluesky handle or account identifier |
| `BSKY_PASSWORD` | yes | — | Bluesky App Password |
| `BSKY_SERVICE_URL` | no | `https://bsky.social` | HTTPS origin of the login service or self-hosted PDS |
| `BLUETIFY_STATE_FILE` | no | `.bluetify-state.json` | Persistent recovery state path |
| `UPDATE_INTERVAL` | no | `30` | Polling interval in seconds, from `10` to `86400` |

## Docker

Build the image and create a named volume for recovery state:

```sh
docker build -t bluetify .
docker volume create bluetify-data
docker run -d \
  --name bluetify \
  --env-file .env \
  --mount source=bluetify-data,target=/data \
  --restart unless-stopped \
  bluetify
```

The volume is important. Without it, a replaced container cannot recover the
original bio after a crash or forced termination.

## Bio safety

Before writing to Bluesky, Bluetify atomically stores the original bio and the
pending update. On restart it reconciles that state with the current profile,
including the case where Bluesky accepted a write but the network response was
lost.

Profile writes use CID compare-and-swap and preserve fields owned by other
clients. If the bio is edited manually while Bluetify is running, Bluetify does
not overwrite the edit: further writes are suspended until restart.

Only run one Bluetify instance for an account and state file. If the state file
is deleted while a managed bio is active, the original value cannot be inferred
reliably.

## Commands

```sh
npm run build
npm run typecheck
npm test
npm audit
```

## Troubleshooting

- Authentication failures: create a new Bluesky App Password and update `.env`.
- No track detected: confirm Last.fm shows the track as “Scrobbling now”.
- Writes suspended: the bio changed outside Bluetify; restart to adopt it as the
  new baseline.
- Recovery errors: verify that `BLUETIFY_STATE_FILE` is writable and persistent.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security
issues should follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
