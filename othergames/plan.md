# Release Plan — Kollekt Games (shipping with the main Kollekt app)

This is the runbook for taking **this** service from "code complete" to "live and consumed
by the released mobile app." The repo code is done; everything below is deploy + coordination
work. Source of truth for the contract is the main repo's `src/lib/gamesApi.ts`.

---

## 0. Status going in

Already done in this repo (verified):

- Contract, enums and field names match `gamesApi.ts`.
- CORS allows the native Capacitor origins (`capacitor://localhost`, `https://localhost`,
  `http://localhost`) + configurable web origins, and answers the `OPTIONS` preflight with
  `GET, POST, OPTIONS` / `Content-Type, x-api-key`.
- Per-key + per-IP rate limiting (`429` + `Retry-After`), runs before auth.
- i18n parity: Norwegian base content + English overlay; round events carry `textByLanguage`.
- `GET /health`, Dockerfile, docker-compose, CI/CD (`.github/workflows/ci.yml`).

**Security decision recorded:** Option 1 — *public-client hardening* (treat the key as a
public identifier + rate limiting + rotation). The app keeps sending `x-api-key`; no
`gamesApi.ts` auth change needed. (Option 2 short-lived tokens / Option 3 backend proxy
remain future upgrades — see §6.)

---

## 1. Pre-flight (in this repo, before deploying)

- [ ] Commit the release work on a branch and open a PR (currently uncommitted on `main`).
- [ ] Decide what to do with the incidental `.gitignore` / `.claude/settings.json` edits —
      keep them out of the release commit unless intended.
- [ ] Confirm CI is green on the PR (typecheck + build + smoke test).
- [ ] Tag a release once merged (e.g. `v1.0.0`) so the CI/CD `image` job publishes a
      versioned, immutable image to GHCR (`ghcr.io/<owner>/kollekt-games:1.0.0`).

## 2. Provision infrastructure

- [ ] Pick a host that gives a **stable public HTTPS URL** (Fly.io / Render / Railway / a
      VPS behind Caddy or nginx — anything with valid TLS). The native build rejects non-HTTPS
      and Android blocks cleartext, so this is non-negotiable.
- [ ] Deploy the published image (`ghcr.io/<owner>/kollekt-games:<tag>`).
      - To publish elsewhere than GHCR, swap the `image`/`login`/`metadata` steps in
        `.github/workflows/ci.yml` (e.g. Docker Hub needs `DOCKERHUB_TOKEN` secret).
- [ ] Set production env vars (do **not** ship `dev-key`):
      - `GAMES_API_KEY=<unique non-guessable string>`
      - `ALLOWED_ORIGINS=https://<your-web-origin>[,https://www.<...>]` (web only — native
        origins are auto-allowed)
      - `TRUST_PROXY=1` (behind a TLS-terminating proxy, so per-IP limiting sees the real IP)
      - optionally tune `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`
- [ ] Point an uptime check at `GET /health`.

## 3. Wire up the main repo

- [ ] In the main app set the games endpoint to the deployed URL **including `/api`**:
      - `VITE_GAMES_API_URL=https://<host>/api`
      - `VITE_GAMES_API_KEY=<same value as GAMES_API_KEY>`
      - These go in the mobile env file (`.env.mobile`) used by the Capacitor build.
- [ ] Confirm `gamesApi.ts` still sends `x-api-key` + `Content-Type: application/json`
      (it does — Option 1 requires no change there).
- [ ] If any field/enum in `gamesApi.ts` has drifted since this hand-off, reconcile it here
      first — renaming a field silently breaks the app.

## 4. Verify against the deployed service (pre-release gate)

Run these against the **live HTTPS URL**, not localhost:

- [ ] HTTPS works; certificate valid.
- [ ] `OPTIONS` preflight to `/api/kollekt/round` returns CORS headers for
      `Origin: capacitor://localhost` **and** `Origin: https://localhost`.
- [ ] `GET /api/games?lang=no` → Norwegian; `?lang=en` → English.
- [ ] `POST /api/kollekt/round` returns a valid `Round`, echoes `usedIds`, and returns
      `{ round: null, usedIds }` (not an error) when no event can be produced.
- [ ] `POST /api/kollekt/summary` → `summaries` with the `SessionPlayerSummary` shape.
- [ ] `GET /api/kollekt/meta` → all four presets + `minPlayers: 2` + `defaultGuestStats`.
- [ ] Missing/invalid `x-api-key` → `401`; exceeding the limit → `429`.
- [ ] **End-to-end on a real device:** run the actual iOS *and* Android build against the
      deployed URL and play a full game (start → several rounds → summary).

## 5. Release & ops

- [ ] Cut the mobile release only after the device test passes on both platforms.
- [ ] Keep rate-limit dashboards / logs visible for the first days; watch for abuse on the
      public key.
- [ ] **Rotation drill:** rotating `GAMES_API_KEY` requires shipping a new app build with the
      new `VITE_GAMES_API_KEY` (the key is compiled into the bundle) — plan a brief overlap
      where the server accepts both old and new if you must rotate without forcing an update.
- [ ] **Rollback:** images are tagged immutably in GHCR; redeploy the previous tag to roll back.

## 6. Known follow-ups (not release blockers)

- **Template recycling:** the engine recycles round templates, so `/kollekt/round` rarely
  returns `round: null` mid-session — the app bounds the game by `maxRounds`/its own state.
  If true exhaustion→null is ever wanted, that's a scoped change to `eventGenerator`.
- **API versioning:** the contract lives at `/api`. If it ever needs to evolve without
  breaking shipped builds, introduce `/api/v1` and have new app versions target it (a
  published mobile build can't be hot-fixed instantly).
- **Stronger auth:** upgrade Option 1 → Option 2 (short-lived scoped tokens from the Kotlin
  backend) or Option 3 (backend proxy so no key ships in the app) when warranted.
