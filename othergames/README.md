# Kollekt Games

Standalone REST API for the Kollekt drinking-game logic and question content.
Extracted from the main Kollekt app so it can live in its own repository and be
consumed by the Kollekt frontend over HTTP with an API key.

It is **stateless**: round generation, scoring and content are pure functions.
The client keeps the per-session state (players, used template ids, round number)
and calls this service for computation and content.

## Run locally

```bash
cp .env.example .env      # set GAMES_API_KEY
npm install
npm run dev               # http://localhost:4000
```

Build & run production:

```bash
npm run build
npm start
```

## Configuration

| Env var                | Default                  | Purpose                                                    |
| ---------------------- | ------------------------ | ---------------------------------------------------------- |
| `PORT`                 | `4000`                   | Listen port                                                |
| `GAMES_API_KEY`        | _(required)_             | Shared secret; sent as `x-api-key` header                  |
| `ALLOWED_ORIGINS`      | `http://localhost:5173`  | Comma-separated **web** CORS origins (native origins auto-allowed) |
| `RATE_LIMIT_WINDOW_MS` | `60000`                  | Rate-limit window in ms (per API key + IP)                 |
| `RATE_LIMIT_MAX`       | `120`                    | Max requests per window before `429`                       |
| `TRUST_PROXY`          | _(off)_                  | Set behind a TLS reverse proxy so per-IP limiting sees the real client IP (hop count or `true`) |

## API

All `/api/*` routes require the header `x-api-key: <GAMES_API_KEY>`.

| Method | Path                  | Body / Query                                              | Returns                                  |
| ------ | --------------------- | -------------------------------------------------------- | ---------------------------------------- |
| GET    | `/health`             | —                                                        | `{ status: "ok" }` (no auth)             |
| GET    | `/api/games`          | `?lang=en\|no`                                           | `DrinkingGameDefinition[]` (localized)   |
| GET    | `/api/games/:id`      | `?lang=en\|no`                                           | one `DrinkingGameDefinition`             |
| GET    | `/api/kollekt/meta`   | —                                                        | `{ presets, minPlayers, defaultGuestStats }` |
| POST   | `/api/kollekt/round`  | `{ roundNumber, players, preset, usedIds, lang }`        | `{ round, usedIds }`                     |
| POST   | `/api/kollekt/summary`| `{ players }`                                            | `{ summaries: (SessionPlayerSummary & { tier })[] }` |

### Example

```bash
curl -H "x-api-key: dev-key" http://localhost:4000/api/games
curl -H "x-api-key: dev-key" http://localhost:4000/api/kollekt/meta
```

## Consuming from Kollekt

Set in the Kollekt frontend's `.env`:

```
VITE_GAMES_API_URL=http://localhost:4000/api
VITE_GAMES_API_KEY=dev-key
```

## Deployment for Mobile (Capacitor) + Web

The service is designed to be called from both the Kollekt web app and its mobile
versions (iOS/Android via Capacitor).

**Native WebView origins are always allowed automatically** — you do **not** list them
in `ALLOWED_ORIGINS`:

- iOS WebView origin: `capacitor://localhost`
- Android WebView origin: `https://localhost`
- (also `http://localhost`)

The `x-api-key` header makes every call "non-simple", so the browser/WebView sends a
preflight `OPTIONS` first. The CORS layer answers it (204) with
`Access-Control-Allow-Methods: GET, POST, OPTIONS` and
`Access-Control-Allow-Headers: Content-Type, x-api-key`.

So you only configure your **web** origins:

```bash
ALLOWED_ORIGINS=https://kollekt.example.com,https://www.kollekt.example.com
GAMES_API_KEY=<unique-non-guessable-string>
```

**HTTPS is required for mobile.** The native build rejects non-HTTPS games URLs and
Android blocks cleartext, so `VITE_GAMES_API_URL` must be `https://` and the service
must sit behind valid TLS. When behind a TLS-terminating proxy, set `TRUST_PROXY` so
per-IP rate limiting uses the real client IP.

### Security Note: Public API Key

The `GAMES_API_KEY` is embedded in all client bundles (web and mobile) and is **not cryptographic**. It should be:

- A unique, non-guessable string per environment (dev/staging/prod)
- Rotatable (change and redeploy clients if compromised)
- Used only to prevent casual abuse, not to protect sensitive data

The API key does **not** authenticate users or protect game history; that is handled by the main Kollekt Kotlin backend. This service is stateless and computes public game content and scores based on player input. See the main Kollekt conversion plan for OAuth and token-storage decisions.

**Chosen release option — Public-client hardening:** the key is treated as a public
identifier, backed by **per-key + per-IP rate limiting** (`RATE_LIMIT_WINDOW_MS` /
`RATE_LIMIT_MAX`, returning `429` with `Retry-After`) and easy rotation via
`GAMES_API_KEY`. The main app's `gamesApi.ts` keeps sending `x-api-key`; no auth-header
change is required.

**Future consideration:** for stronger guarantees, the Kotlin backend can hand out
short-lived scoped tokens or proxy requests (adding signed user context) so a static
shared secret never ships in the app.
