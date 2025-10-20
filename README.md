<div align="center">

# Bluetify
Music (spotify & last.fm) integration for Bluesky bio

</div>

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/unicodick/bluetify.git
cd bluetify
```

**2. Set up Spotify App**

- Navigate to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- Create a new app
- Save your `Client ID` and `Client Secret`
- Add redirect URI: `https://spotify-refresh-token-generator.netlify.app`

**3. Generate Refresh Token**

- Visit [Spotify Refresh Token Generator](https://spotify-refresh-token-generator.netlify.app)
- Enter your credentials
- Required scope: `user-read-currently-playing`
- Copy the generated refresh token

**4. Set up Last.fm**

- Navigate to [Last.fm API](https://www.last.fm/api/account/create)
- Create an API account and get your API key
- Note your Last.fm username

**5. Configure Environment**

```bash
cp .env.example .env
```

Edit `.env` with your credentials or configure `docker-compose.yml` directly.

**6. Run Application**

```bash
npm ci && npm run build
npm start
```

---

## Docker

Run with Docker Compose:

```bash
docker build -t bluetify .
docker compose up -d
```
