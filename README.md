# bluetify

Updates your [Bluesky](https://bsky.app) bio with whatever you're currently listening to on [Last.fm](https://last.fm).

---

```sh
git clone https://github.com/unicodick/bluetify.git
cd bluetify
cp .env.example .env
```

Fill in `.env`:

```env
LASTFM_API_KEY=apikey
LASTFM_USERNAME=user
BSKY_USERNAME=user.handle
BSKY_PASSWORD=apppasword
UPDATE_INTERVAL=30
```

> Get your Last.fm API key at [last.fm/api/account/create](https://www.last.fm/api/account/create).  
> Use a Bluesky [App Password](https://bsky.app/settings/app-passwords), not your main password.  
> `UPDATE_INTERVAL` is in seconds, minimum `10`, default `30`.

```sh
npm ci && npm run build && npm start
```

## Docker

```sh
docker build -t bluetify .
docker run -d --env-file .env --name bluetify bluetify
```
