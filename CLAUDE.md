# CLAUDE.md

Guidance for working in this repository. For the full deep-dive, see [KOLLEKT_OVERVIEW.md](KOLLEKT_OVERVIEW.md); for setup, see [README.md](README.md).

## What Kollekt is

Kollekt is a mobile-first app for shared households / collectives ("kollektiv"). Roommates use it to manage chores, shared money, shopping, a shared calendar, group chat, and a layer of gamification (XP, levels, leaderboards, achievements), plus an in-app party-games mode. It has grown beyond the original chore/economy core into a broader shared-living app: task swapping, house rules, maintenance tickets, house check-ins, guest notices & quiet hours, kudos, friendships, payment settle-up handles, social login, and password reset.

Originally a student project (DAT251) based on a Figma export.

## How the app works (the mental model)

- A user signs up / logs in (email+password **or** social login) and belongs to one **Collective** (a household, identified by a `join_code`).
- Almost every entity carries a `collective_code` and is scoped to that collective.
- **Identity is by name.** `memberName` is the de-facto key across the API — member names are globally unique (`uq_members_name`). Most `GET`/`PATCH` endpoints require a `memberName` query param.
- The frontend is a React SPA. The same source is packaged as web (nginx) and as native iOS/Android via Capacitor — all three talk to the same deployed Kotlin backend over HTTPS/WSS. No backend code is embedded in the mobile apps.
- **Realtime is "notify then refetch":** a WebSocket (`/ws/collective?memberName=...`) pushes events describing *what changed* (e.g. `NOTIFICATION_CREATED`, `TASK_DEADLINE_SOON`); the client responds by refetching over REST.
- **Games run in-app**, bundled at build time — no game HTTP service, no API key. The one exception is prompt-relay multiplayer rooms, which coordinate through `/api/party-game`.

## Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind, react-router-dom, TanStack Query, i18next, framer-motion.
- **Mobile:** Capacitor iOS/Android shells (app id `no.kollekt.app`).
- **Backend:** Spring Boot (Kotlin), package `com.kollekt`. Layered **api → service → repository → domain**.
- **Database:** PostgreSQL (Supabase in prod; local Postgres in Docker Compose), Flyway migrations (**V1 → V59**).
- **Realtime:** WebSockets. **No Redis, no Kafka** (both removed — tokens moved to PostgreSQL `auth_tokens`, stats computed on demand).
- **DevOps:** Docker / Docker Compose / GitHub Actions → Docker Hub.

## Repository layout

- `src/` — React frontend (see below).
- `backend/` — Kotlin Spring Boot backend (`com.kollekt`).
- `othergames/` — sibling workspace holding game **content + engine**, imported directly as TypeScript source. It also ships a legacy standalone Express server (`src/server.ts` + its own Dockerfile/compose) that **the running app does not use**.
- `ios/`, `android/` — committed Capacitor native projects.
- `assets/`, `public/`, `nginx/` — icons/splash, static assets, frontend nginx config.
- `.github/workflows/ci-cd.yml` — CI/CD.

### Frontend (`src/`)

- Entry & routing: `src/main.tsx` → `src/App.tsx` (react-router). `AppLayout` wraps main pages (header + bottom nav) and includes a first-run `TourOverlay`.
- Auth/session: `src/context/UserContext.tsx` (restores token-backed session, loads `/onboarding/me`, opens realtime WS). Tokens stored via `src/lib/authStorage.ts` (native Keychain/Keystore; `localStorage` on web).
- API client: `src/lib/api.ts` — central `fetch` wrapper, attaches Bearer token, auto-refreshes on 401 via `/onboarding/refresh`. Use `api.get/post/patch/delete/postForm`.
- Realtime: `src/lib/realtime.ts` — `connectCollectiveRealtime(memberName, onEvent)`, reconnecting WS.
- Shared types: `src/lib/types.ts` — the contract mirror of backend DTOs.
- Pages: `src/pages/` — bottom-nav tabs are Home `/`, Tasks `/tasks`, Calendar `/calendar`, Chat `/chat`, Economy `/economy`, Social `/social`.
- Games UI: `src/games/`; catalog in `src/games/catalog.ts`; launcher in `src/pages/social/GamesPanel.tsx`; engine bridge in `src/lib/kollektGame.ts` (imports from `othergames/src/engine` and `othergames/src/content`).
- i18n: `src/i18n/` — four languages: English, Norwegian, Swedish, Danish (`locales/en/no/sv/da.json`). Language key `kollekt-language`, fallback `no`. Locale bundles are code-split; call `loadLanguage()` before `changeLanguage`.

### Backend (`backend/`, `com.kollekt`)

- Entry: `KollektApplication.kt`. Controllers in `api/` (DTOs in `api/dto/ApiModels.kt`), business logic in `service/` (`*Operations` / `*Service` classes), Spring Data JPA in `repository/`, JPA entities in `domain/`, security/websocket/CORS in `config/`.
- Flyway migrations in `backend/src/main/resources/db/migration` (`V1` baseline → `V59`).
- Tests under `backend/src/test`: `service/*Test`, `api/*ContractTest`, `acceptance/*` (user-story acceptance tests, see `user-story-test-mapping.md`).

## Common commands

```bash
# Frontend (web)
npm install
npm run dev            # Vite dev server (:5173), proxies /api
npm run build          # web build
npm run typecheck      # tsc --noEmit

# Full stack locally (backend + frontend + local Postgres)
docker compose up --build   # frontend :5173, backend :8080/api

# Backend
cd backend && ./gradlew bootRun    # needs a Postgres on localhost:5432 (or adjust ../.env)
cd backend && ./gradlew test       # backend tests

# Mobile (Capacitor) — requires .env.mobile with an absolute HTTPS backend URL
npm run mobile:sync           # build (mode mobile) + cap sync
npm run mobile:run:ios        # sync + run on iOS simulator/device
npm run mobile:run:android    # sync + run on Android emulator/device
```

## Conventions & gotchas

- **Add a game:** append to `GAME_CATALOG` in `src/games/catalog.ts`, add i18n keys, and wire the component + launch branch in `GamesPanel.tsx`. Do **not** add HTTP calls for game content — it is bundled from `othergames/`.
- **Every new table needs RLS:** Supabase publishes the whole `public` schema over PostgREST, so `V57`–`V59` turned on row-level security (with **no** policies) for every table — the `anon`/`authenticated` API roles are denied outright while the table-owning JDBC role bypasses RLS, keeping authorization in the API layer. End any migration that creates a table with `alter table <name> enable row level security;`. Never use `force row level security` — it would apply the (empty) policy set to the owner and break the backend. **Never `alter table flyway_schema_history` from a migration:** Flyway holds a `for update` row lock on it for the whole run, so any `alter table` on it deadlocks until the statement timeout kills the migration — change that table out-of-band only.
- **Types are a manual contract mirror:** changes to backend DTOs (`ApiModels.kt`) should be reflected in `src/lib/types.ts`.
- **Env files:** web dev uses `.env` (with `/api` proxy); mobile uses `.env.mobile` (absolute HTTPS URL). Examples committed as `*.example`.
- **Realtime pattern:** when adding a feature that changes shared state, emit a WS event server-side and refetch client-side rather than pushing full payloads over the socket.
- **Two settlement models** in economy: collective-wide `SettlementCheckpoint` and per-pair `PersonalSettlement`; settle-up can deep-link the creditor's registered payment handles (`src/lib/paymentLinks.ts`).
- **Smart/fair automatic task assignment is scaffolding only** (V4–V9 columns, `assignmentReason`) — there is no live algorithm; tasks are created with an explicit assignee. Task *swapping* (V42) is live.
- The `othergames/` standalone server, Redis, and Kafka are all **legacy/removed** — don't wire the app to them.
