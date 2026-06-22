# Kollekt — System Overview

> Living context/plan document. Update as the system evolves.

**What it is:** A student project (DAT251) — a mobile-first web app for shared households / collectives ("kollektiv"). Roommates manage chores, money, shopping, a shared calendar, group chat, and gamification (XP, levels, leaderboards, achievements), plus an in-app party games mode. The games (e.g. Spin the Wheel) run entirely in the app from a local `src/games/` module — no external service. Originally based on a Figma export.

**Stack:** React + TypeScript (Vite) frontend · Capacitor iOS/Android shells · Spring Boot (Kotlin) backend · PostgreSQL (Supabase) · WebSockets (realtime) · Docker / Docker Compose / GitHub Actions CI-CD.

> **Removed in recent cleanup:** Redis (cache + token store) and Kafka (messaging). See [Recent architecture changes](#recent-architecture-changes) for what replaced them.

**Games:** run in-app from the local `src/games/` module (catalog + self-contained game components like Spin the Wheel). No external service or API key.

---

## Recent architecture changes

These are the in-flight structural changes this doc was updated to reflect. Items marked _(decision pending)_ are reasonable defaults that can still change.

1. **Games are local, in-app (no external service).** Games now live in the `src/games/` module: a `catalog.ts` of game metadata + categories and self-contained game components (e.g. `SpinTheWheel.tsx`). They are surfaced through the unified **Social** page (`/social`, `SocialPage` with `RanksPanel` + `GamesPanel`). The earlier external "Kollekt Games" REST service and its client (`src/lib/gamesApi.ts`, `GamesPage`, `CollektGamePage`, and the `VITE_GAMES_API_*` env vars) have been **removed** — no API key, no backend proxy.
2. **Redis removed.** The two consumers were token storage and the stats/leaderboard cache:
   - **Token store** (refresh + revoked tokens) → moved to **PostgreSQL** (`TokenEntry` entity + `TokenEntryRepository`, table `auth_tokens` via migration **V32**). Expiry is enforced at query time; expired rows are purged on write.
   - **Stats/leaderboard cache** → **computed on demand** (no cache; `StatsCacheService` and the direct `RedisTemplate` reads/writes in `StatsService` are gone).
3. **Kafka removed.** Integration events (`IntegrationEventPublisher` / `IntegrationEventConsumer`) were **dropped entirely** — the consumer only logged and nothing consumed the events meaningfully. Realtime updates are unaffected — they already run over WebSockets, not Kafka.

---

## High-level architecture

```
React SPA source (Vite)
 ├── Web build (:5173/nginx)
 ├── iOS shell (Capacitor)
 └── Android shell (Capacitor)
 │  REST /api/*  (JWT Bearer access + refresh tokens)
 │  WS  /ws/collective?memberName=...  (live updates)
 ▼
Spring Boot backend (Kotlin, :8080)
 ├── api/         REST controllers
 ├── service/     business logic ("Operations" classes)
 ├── repository/  Spring Data JPA
 ├── domain/      JPA entities
 └── config/      security, websocket, web (CORS)
 ▼
PostgreSQL (Supabase)   ← also holds refresh/revoked tokens now

   ┌──────────────────────────────────────────────────────┐
   │  Games: local module in src/games/ (runs in the app)  │
   │  catalog.ts + components (e.g. SpinTheWheel.tsx)       │
   └──────────────────────────────────────────────────────┘
```

A user logs in → belongs to a **Collective** (household, identified by a `join_code`). Almost every entity carries a `collective_code` and is scoped to that collective. The `memberName` is used pervasively as the identity key in queries (note: names are globally unique — `uq_members_name`).

---

## Frontend (`/src`)

**Entry & routing** — `src/main.tsx` → `src/App.tsx`. Routing via `react-router-dom`:
- `GuestOnlyRoute` → `/login`
- `AuthOnlyRoute` → `/create-household` (authed but no collective yet)
- `AppLayout` wraps all main pages (with header + bottom nav)
- Catch-all redirects to `/`

**Auth/session state** — `src/context/UserContext.tsx`: holds `currentUser`, asynchronously restores the token-backed session, loads `/onboarding/me` on boot, manages notifications, and opens the realtime WS connection. `src/lib/authStorage.ts` stores native access/refresh tokens in iOS Keychain or Android Keystore-backed encrypted storage and uses `localStorage` only for the web build. Non-sensitive cached user display data remains in `localStorage`.

**API client** — `src/lib/api.ts`: central `fetch` wrapper. Attaches `Bearer` token, auto-refreshes on 401 via `/onboarding/refresh`, sanitizes error messages through i18n. Exposes `api.get/post/patch/delete/postForm`.

**Games module** — `src/games/`: a local `catalog.ts` (game metadata, categories, "tonight's pick") plus self-contained game components (e.g. `SpinTheWheel.tsx`). Everything runs client-side — no network calls, no API key.

**Realtime** — `src/lib/realtime.ts`: `connectCollectiveRealtime(memberName, onEvent)` opens a reconnecting WebSocket to `/ws/collective`; events like `NOTIFICATION_CREATED`, `TASK_DEADLINE_SOON`, etc. trigger refetches.

**Shared types** — `src/lib/types.ts`: the contract mirror of backend DTOs (Task, Expense, CalendarEvent, ChatMessage, Leaderboard, Achievement, AppUser, etc.).

**Layout & nav** — `AppLayout.tsx`, `AppHeader.tsx`, `BottomNav.tsx` (6 tabs: Home, Tasks, Calendar, Chat, Economy, Social), `LanguageSwitcher.tsx`.

**UI kit** — `src/components/ui/`: shadcn/Radix-based primitives (button, dialog, card, etc.) + custom flair (`Confetti`, `Sparkles`, `AnimatedButton`). Styling via Tailwind (`src/styles/globals.css`).

**i18n** — `src/i18n/`: English + Norwegian (`en.json`, `no.json`).

### Pages (`/src/pages`)
| Page | Route | Purpose |
|---|---|---|
| `LoginPage` | `/login` | Sign up / log in |
| `CreateHouseholdPage` | `/create-household` | Create or join a collective by code |
| `DashboardPage` | `/` | Home: user XP/level/rank, upcoming tasks & events, recent expenses, pending shopping |
| `TasksPage` | `/tasks` | Chores: create/assign/complete, recurrence, categories, XP/penalty, feedback |
| `CalendarPage` | `/calendar` | Shared events; Google Calendar sync |
| `ChatPage` | `/chat` | Group chat: reactions, polls, images, replies |
| `EconomyPage` | `/economy` | Expenses, balances, settle-up |
| `PantTrackerPage` | `/economy/pant` | Bottle-deposit ("pant") tracker toward a shared goal |
| `SocialPage` | `/social` | Ranks (leaderboard, period stats, monthly prize, achievements) + Games (local catalog, Spin the Wheel). `/leaderboard` and `/games` redirect here. |
| `ProfilePage` | `/profile` | Profile, settings, notification prefs, logout |

### Games — local module (`src/games/`)

Games run entirely in the app; there is no external games service and no `gamesApi.ts`. `src/games/catalog.ts` defines the game list (id, category, difficulty, players, duration, emoji), the category filters, and the daily "tonight's pick". Playable games are self-contained React components — currently `SpinTheWheel.tsx` (a client-side wheel that picks a housemate). Other catalog entries render as "coming soon" until their component is added. Add a game by appending to `GAME_CATALOG` and launching it from `GamesPanel`.

---

## Backend (`/backend`, package `com.kollekt`)

Entry: `KollektApplication.kt`. Layered: **api → service → repository → domain**.

### API controllers (`/api`)
| Controller | Base path | Area |
|---|---|---|
| `OnboardingController` | `/api/onboarding` | signup, login, refresh, logout, `/me`, create/join collective, join code |
| `TaskController` | `/api/tasks` | tasks + shopping items, regret/late-complete, feedback |
| `CalendarController` | `/api/events` | events |
| `GoogleCalendarController` | `/api/google-calendar` | OAuth + sync |
| `ChatController` | `/api/chat` | messages, reactions, polls, images |
| `EconomyController` | `/api/economy` | expenses, balances, pant, summary, settle |
| `StatsController` | `/api` | dashboard, leaderboard, achievements |
| `MemberController` | `/api/members` | collective members, status |
| `InvitationController` | `/api/invitations` | email invites |
| `NotificationController` | `/api/notifications` | list/read/delete, preferences |
| `PushNotificationController` | `/api/push` | mobile push device-token register/remove |
| `InvitationRealtimeController`, `AuthVerification`, `ApiExceptionHandler` | — | realtime invites, auth helper, global error → JSON `{error}` |

> The former `GET /api/drinking-game/question` endpoint (served by `StatsController`) has been removed from the Kollekt backend; games no longer involve the backend at all (they run in-app from `src/games/`).

DTOs live in `api/dto/ApiModels.kt`.

### Services (`/service`) — the business logic ("*Operations*" + "*Service*")
- **Account/auth:** `AccountOperations`, `TokenService`, `TokenStoreService` (now **PostgreSQL-backed** — was Redis), `UserProfileService`, `CollectiveAccessService` (authorization scoping)
- **Domain ops:** `CollectiveOperations`, `MemberOperations`, `TaskOperations`, `TaskMaintenanceService` (deadline reminders, expiring overdue tasks), `ShoppingOperations`, `EventOperations`, `EconomyOperations`, `ChatOperations`
- **Gamification/stats:** `StatsService` (XP, levels, streaks, leaderboard periods, achievement definitions). The former `StatsCacheService` (Redis cache invalidation) is removed — stats/leaderboard/dashboard are computed on demand.
- **Notifications/realtime:** `NotificationService`, `RealtimeUpdateService`, `InvitationRealtimeService`
- **Integration/messaging:** the former Kafka integration events (`IntegrationEventPublisher` / `IntegrationEventConsumer`) were **dropped entirely** — there is no replacement event bus; realtime runs over WebSockets. `GoogleCalendarService` is unchanged.

### Repositories (`/repository`)
Spring Data JPA interfaces, one per aggregate (Member, Collective, Task, TaskFeedback, ShoppingItem, Event, Expense, PantEntry, PersonalSettlement, SettlementCheckpoint, ChatMessage, Notification, Achievement, Invitation, Room). _A token repository backs the now-DB-resident refresh/revoked tokens, and `PushDeviceTokenRepository` backs mobile push device tokens._

### Domain entities (`/domain`)
Member, Collective, Room, TaskItem, TaskFeedback, ShoppingItem, CalendarEvent, Expense, PersonalSettlement, SettlementCheckpoint, PantEntry, ChatMessage, Notification, Achievement, Invitation, TokenEntry (`auth_tokens`), PushDeviceToken (`push_device_tokens`).

### Config (`/config`)
- `SecurityConfig` + `RevokedTokenValidator` — JWT auth, token revocation (revocation list now read from PostgreSQL)
- `WebSocketConfig` + `CollectiveWebSocketHandler` — `/ws/collective` live channel per collective
- `WebConfig` (CORS etc.)
- _Removed:_ `KafkaConfig`, `RedisConfig`.

### Database (`/resources/db/migration`)
Flyway migrations, **V1 baseline → V33**. Baseline (`V1`) defines the core tables. Later migrations layer on features: task recurrence (V10), penalty XP (V11), notifications (V12–13), chat reactions/polls/images/replies (V14, V15, V18, V31), Google Calendar (V19), monthly prize (V20), task feedback (V21), shopping completion timestamps (V22), notification prefs (V23), event end-time (V24), pant goal (V25), expense deadlines (V26), personal settlements (V27), task category normalization (V28–29), achievement config (V30), token store (V32 — `auth_tokens`, replaces Redis), push device tokens (V33 — `push_device_tokens`). Migrations V4–V9 added "smart assignment" scaffolding (assignment history, member chemistry, preferences, scores, assignment reason).

> **Migration V32 (Redis removal):** `V32__add_token_store.sql` creates the `auth_tokens` table that backs the now DB-resident refresh/revoked tokens (the data previously held in Redis).

---

## Notable design notes / current state

- **Identity by name:** `memberName` is the de-facto key across the API; member names are globally unique.
- **Games are local:** game catalog and logic live in `src/games/` and run entirely in the app — no external service, API, or key.
- **No Redis, no Kafka:** tokens live in PostgreSQL and stats are computed on demand; the former Kafka integration events were dropped rather than replaced. WebSockets remain the realtime transport.
- **Smart task assignment is scaffolding, not yet active.** DB columns and the `assignmentReason` field exist (V4–V9), but there's **no live assignment algorithm** consuming chemistry/preferences/fairness scores yet — tasks are created with an explicit assignee. `ideas.md` flags this ("empty feature") and lists intended fairness/preference/ML directions. **Prime area for future work.**
- **Realtime is push-notify-then-refetch:** WS events tell the client *what changed*; the client refetches via REST.
- **Two settlement models:** collective-wide `SettlementCheckpoint` and per-pair `PersonalSettlement`.

## Infra & ops
- `docker-compose.yml` — backend, frontend (DB is external Supabase via `.env`). Redis, Zookeeper, and Kafka containers have been removed.
- **Games:** no service to deploy — they run in-app from `src/games/`.
- **Mobile packaging:** the existing Vite output is packaged in committed Capacitor `ios/` and `android/` projects using application ID `no.kollekt.app`. Both native apps continue calling the deployed Kotlin backend over HTTPS/WSS; no backend code is embedded in the app.
- **Mobile layout:** the shared shell accounts for iOS/Android safe-area insets, dynamic viewport height, the fixed bottom navigation, and touch devices without hover capability.
- **Mobile environment:** `npm run mobile:sync` builds in Vite's `mobile` mode and requires `.env.mobile` to provide the absolute HTTPS URL for the deployed backend. Local web development continues using `.env` and the `/api` proxy.
- **Google Calendar on mobile:** OAuth opens in the native browser and returns through `no.kollekt.app://google-calendar-connected`. The backend accepts only configured web/native return URLs and stores each OAuth state as a short-lived, single-use nonce; no Google or Kollekt tokens are placed in the app return link.
- **Mobile native polish:** status bar and splash screen are configured in `capacitor.config.ts` and initialised in `src/lib/nativeBootstrap.ts`; app icons/splash are generated from `assets/` via `@capacitor/assets`; light haptics fire on key task/game actions through `src/lib/haptics.ts`.
- **Push notifications:** the client foundation (permission, device-token registration after login, and notification-tap deep links) lives in `src/lib/pushNotifications.ts`; tokens are persisted via `POST /api/push/device-token` (`PushNotificationController` + `push_device_tokens` table). Actual APNs/FCM delivery is configured separately and is not yet wired.
- `Dockerfile` + `nginx/` — frontend container served by nginx.
- `.github/workflows/ci-cd.yml` — builds frontend + backend on push/PR to `main`, publishes `kollekt-frontend`/`kollekt-backend` images to Docker Hub.
- Tests: backend has broad coverage under `backend/src/test` — `service/*Test`, `api/*ContractTest`, and `acceptance/*` (user-story acceptance tests, mapped in `user-story-test-mapping.md`). The Redis/Kafka and drinking-endpoint tests have been removed; `TokenStoreServiceTest` now exercises the PostgreSQL-backed store.

---

## Ideas / backlog (see `ideas.md`)
Smart/fair task assignment, task swapping & voting, adaptive recurrence, away/vacation planning, richer analytics, role management, collective goals & rewards, IoT verification, calendar integrations, audit trail.
