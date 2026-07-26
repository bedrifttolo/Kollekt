# Kollekt — System Overview

> Living context/plan document. Update as the system evolves.

**What it is:** A student project (DAT251) — a mobile-first web app for shared households / collectives ("kollektiv"). Roommates manage chores, money, shopping, a shared calendar, group chat, and gamification (XP, levels, leaderboards, achievements), plus a rich in-app party-games mode. It has since grown well past the original chore/economy core into a broader "shared-living" app: task swapping, house rules, maintenance tickets, house check-ins, guest notices & quiet hours, kudos, friendships, payment settle-up handles, social login, and password reset. Originally based on a Figma export.

**Stack:** React + TypeScript (Vite) frontend · Capacitor iOS/Android shells · Spring Boot (Kotlin) backend · PostgreSQL (Supabase) · WebSockets (realtime) · Docker / Docker Compose / GitHub Actions CI-CD.

**Games:** run in-app. Game UI lives in `src/games/`; the shared game **content + engine** lives in a sibling `othergames/` workspace and is imported directly as TypeScript source (no HTTP, no API key — see [Games](#games--in-app-srcgames--othergames)). The only games that touch the backend are the **prompt-relay rooms** (multiplayer coordination via `PartyGameController`).

> **Architecture history:** Earlier this project ran Redis (cache + token store) and Kafka (messaging); both were removed. Tokens moved to PostgreSQL (`auth_tokens`, V32) and stats are computed on demand; Kafka integration events were dropped (realtime runs over WebSockets). The drinking-game logic was also briefly extracted into an external REST service — that service still exists as the `othergames/` workspace, but the app now consumes it as **local source modules**, not over HTTP.

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
 ├── service/     business logic ("Operations" / "Service" classes)
 ├── repository/  Spring Data JPA
 ├── domain/      JPA entities
 └── config/      security, websocket, web (CORS)
 ▼
PostgreSQL (Supabase)   ← also holds refresh/revoked tokens

   ┌───────────────────────────────────────────────────────────────┐
   │  Games UI: src/games/  (runs in the app)                        │
   │  Game content + engine: othergames/  (imported as TS source)    │
   │  Exception: prompt-relay rooms coordinate via /api/party-game   │
   └───────────────────────────────────────────────────────────────┘
```

A user logs in (email/password or social login) → belongs to a **Collective** (household, identified by a `join_code`). Almost every entity carries a `collective_code` and is scoped to that collective. The `memberName` is used pervasively as the identity key in queries (note: names are globally unique — `uq_members_name`).

---

## Frontend (`/src`)

**Entry & routing** — `src/main.tsx` → `src/App.tsx`. Routing via `react-router-dom`:
- `GuestOnlyRoute` → `/login`
- `/reset-password` → `ResetPasswordPage` (unguarded; reached from a reset email link)
- `AuthOnlyRoute` → `/create-household` (authed but no collective yet)
- `AppLayout` wraps all main pages (header + bottom nav); includes a first-run `TourOverlay`
- Catch-all redirects to `/`

**Auth/session state** — `src/context/UserContext.tsx`: holds `currentUser`, asynchronously restores the token-backed session, loads `/onboarding/me` on boot, manages notifications, and opens the realtime WS connection. `src/lib/authStorage.ts` stores native access/refresh tokens in iOS Keychain or Android Keystore-backed encrypted storage and uses `localStorage` only for the web build. Non-sensitive cached user display data remains in `localStorage`.

**API client** — `src/lib/api.ts`: central `fetch` wrapper. Attaches `Bearer` token, auto-refreshes on 401 via `/onboarding/refresh`, sanitizes error messages through i18n. Exposes `api.get/post/patch/delete/postForm`.

**Social login** — `src/lib/socialAuth.ts`: detects available providers, runs the native/web sign-in flow, and posts the resulting identity to `/onboarding/oauth/{provider}`. Surfaced from `LoginPage`.

**Payments / settle-up** — `src/lib/paymentLinks.ts`: builds the payment methods a creditor has registered (Vipps / MobilePay / PayPal / bank account, the `PaymentHandles` type in `types.ts`) and opens the right deep-link (PayPal.me with amount; Vipps/MobilePay app schemes via `@capacitor/app-launcher`; bank = copy account number). On native, `openPaymentLink` checks `canOpenUrl` first (schemes are declared in `LSApplicationQueriesSchemes` / the Android `<queries>` manifest) and returns `false` when the payment app isn't installed, so `EconomyPage` falls back to copying the handle instead of failing silently. Handles are registered in `ProfilePage` and used during settle-up in `EconomyPage`.

**Games** — see the [Games](#games--in-app-srcgames--othergames) section.

**Realtime** — `src/lib/realtime.ts`: `connectCollectiveRealtime(memberName, onEvent)` opens a reconnecting WebSocket to `/ws/collective`; events (e.g. `NOTIFICATION_CREATED`, `TASK_DEADLINE_SOON`) trigger refetches.

**Shared types** — `src/lib/types.ts`: the contract mirror of backend DTOs (Task, Expense, CalendarEvent, ChatMessage, Leaderboard, Achievement, AppUser, PaymentHandles, Friendship, etc.).

**Layout & nav** — `src/components/`: `AppLayout.tsx`, `AppHeader.tsx`, `BottomNav.tsx` (6 tabs: Home `/`, Tasks `/tasks`, Calendar `/calendar`, Chat `/chat`, Economy `/economy`, Social `/social`), `LanguageSwitcher.tsx`, `TourOverlay.tsx` (onboarding tour).

**UI kit** — `src/components/ui/` and `src/components/ui-kit/`: shadcn/Radix-based primitives (button, dialog, card, etc.) + custom flair (`Confetti`, `Sparkles`, `AnimatedButton`). Styling via Tailwind (`src/styles/globals.css`).

**i18n** — `src/i18n/`: **four languages — English, Norwegian, Swedish, Danish** (`locales/en.json`, `no.json`, `sv.json`, `da.json`), wired in `src/i18n/index.ts` with `i18next-browser-languagedetector` (localStorage key `kollekt-language`, fallback `no`). Locale bundles are **code-split**: only the active language (plus the Norwegian fallback) loads at boot via top-level await; `loadLanguage()` fetches a locale chunk before `changeLanguage` (see `LanguageSwitcher`).

**Performance** — routes are lazy-loaded in `src/App.tsx` (each page is its own chunk; a Suspense boundary inside `AppLayout` keeps header/nav visible while a tab chunk loads), and `main.tsx` fires a fire-and-forget `warmUpBackend()` ping to `/api/health` at boot so a Render cold start overlaps with the login screen instead of the first real request (backup for `.github/workflows/keepalive.yml`).

### Pages (`/src/pages`)
| Page | Route | Purpose |
|---|---|---|
| `LoginPage` | `/login` | Sign up / log in (email + social), forgot-password request |
| `ResetPasswordPage` | `/reset-password` | Confirm a password reset from an emailed link |
| `CreateHouseholdPage` | `/create-household` | Create or join a collective by code |
| `DashboardPage` | `/` | Home: XP/level/rank, upcoming tasks & events, recent expenses, pending shopping, check-in prompts |
| `TasksPage` | `/tasks` | Chores: create/assign/complete, recurrence, categories, XP/penalty, feedback, **task-swap requests**, **maintenance tickets** |
| `CalendarPage` | `/calendar` | Shared events; Google Calendar sync; **guest notices & quiet hours**; **house check-ins** |
| `ChatPage` | `/chat` | Group chat: reactions, polls, images, replies; **kudos**, check-in surfacing |
| `EconomyPage` | `/economy` | Expenses, balances, settle-up (with **payment links**), maintenance-cost split |
| `PantTrackerPage` | `/economy/pant` | Bottle-deposit ("pant") tracker toward a shared goal |
| `SocialPage` | `/social` | Ranks (leaderboard, period stats, monthly prize, achievements) + Games. `/leaderboard` and `/games` redirect here. |
| `CollektGamePage` | `/games/kollekt` | The stat-based "Kollekt" party round game (driven by the `othergames` engine) |
| `ProfilePage` | `/profile` | Profile, settings, member color, payment handles, notification prefs, kudos, logout |

> Several newer collective-life features (house rules, friendships, etc.) are backend-complete and surface through existing pages/components rather than dedicated routes.

### Games — in-app (`src/games/` + `othergames/`)

Games run in the app. The **UI components** live in `src/games/`; the shared **content and engine** live in the sibling `othergames/` workspace and are imported directly as TypeScript source (e.g. `import { getDrinkingGame } from '../../othergames/src/content'`, and the round/scoring engine from `../../othergames/src/engine` via `src/lib/kollektGame.ts`). There is **no `gamesApi.ts`, no `VITE_GAMES_API_*` env, and no HTTP call** for game content — it is bundled at build time.

`src/games/catalog.ts` defines the catalog (`GAME_CATALOG`: id, `titleKey`/`descriptionKey` i18n keys, emoji, category `classic|party|cards`, difficulty, `minPlayers`, `minutes`, `playable`, and flags `drinkingGameId` / `roomGame` / `soloGame`), the category filters, and the deterministic daily `tonightsPick()`.

`src/pages/social/GamesPanel.tsx` lists the catalog and launches the right component:
- **Solo / wheel:** `DiceGame`, `LiarsDiceGame`, `SpinTheWheel`
- **Player-setup games** (via `PlayerSetup`): `MexicanGame`, `KingsCupGame`, `CategoriesGame`, `CharadesGame`
- **Drinking prompt decks** (`PromptGame`, driven by `othergames` content): `hundred-questions`, `truth-or-chug`, `never-have-i-ever` (content JSON in `othergames/src/content/*.json`, en/no translations)
- **Prompt-relay room** (`RoomPromptGame`): the one game that hits the backend, coordinating a multiplayer room via `/api/party-game/rooms`
- **Kollekt** (`id: 'kollekt'`): navigates to `CollektGamePage` (`/games/kollekt`)

Add a game by appending to `GAME_CATALOG`, adding its i18n keys, and wiring its component (and launch branch) in `GamesPanel`.

The `othergames/` workspace also contains a standalone Express server (`src/server.ts`, `Dockerfile`, its own `docker-compose.yml`, `README.md`) — legacy from when game content was a separate REST service. **That server is not used by the running app**; only the `src/content` and `src/engine` modules are imported.

---

## Backend (`/backend`, package `com.kollekt`)

Entry: `KollektApplication.kt`. Layered: **api → service → repository → domain**.

### API controllers (`/api`)
| Controller | Base path | Area |
|---|---|---|
| `OnboardingController` | `/api/onboarding` | signup, login, refresh, logout, `/me`, create/join collective, join code, **`/oauth/{provider}`**, **`/password-reset/request`** & **`/password-reset/confirm`** |
| `TaskController` | `/api/tasks` | tasks + shopping items, recurrence series, regret/late-complete, feedback |
| `TaskSwapRequestController` | `/api/tasks/.../swap` | task-swap requests between members |
| `MaintenanceTicketController` | `/api/maintenance/tickets` | maintenance tickets + maintenance-cost split |
| `CalendarController` | `/api/events` | events |
| `CalendarFeedController` | `/api/calendar-feed` | iCal/ICS calendar feed export |
| `GoogleCalendarController` | `/api/google-calendar` | OAuth + sync |
| `GuestNoticeController` | `/api/guest-notices` | guest notices & quiet hours |
| `HouseCheckinController` | `/api/collectives/.../checkins` | house check-ins |
| `HouseRuleController` | `/api/collectives/.../house-rules` | house rules |
| `ChatController` | `/api/chat` | messages, reactions, polls, images, replies |
| `KudoController` | `/api/kudos` | peer kudos (typed) |
| `EconomyController` | `/api/economy` | expenses, balances, pant, summary, settle |
| `StatsController` | `/api` | dashboard, leaderboard, achievements |
| `MemberController` | `/api/members` | members, status, color, payment handles, invite, leave/delete |
| `PartyGameController` | `/api/party-game` | prompt-relay multiplayer rooms |
| `InvitationController` | `/api/invitations` | email invites |
| `NotificationController` | `/api/notifications` | list/read/delete, preferences |
| `PushNotificationController` | `/api/push` | mobile push device-token register/remove |
| `InvitationRealtimeController`, `AuthVerification`, `ApiExceptionHandler` | — | realtime invites, auth helper, global error → JSON `{error}` |

DTOs live in `api/dto/ApiModels.kt`.

### Services (`/service`)
- **Account/auth:** `AccountOperations`, `TokenService`, `TokenStoreService` (PostgreSQL-backed), `UserProfileService`, `CollectiveAccessService` (authorization scoping), `SocialAuthService` (OAuth provider sign-in), `PasswordResetService` + `PasswordResetMailer` (reset tokens + email)
- **Domain ops:** `CollectiveOperations`, `MemberOperations`, `TaskOperations`, `TaskSwapOperations`, `TaskMaintenanceService` (deadline reminders, expiring overdue tasks), `ShoppingOperations`, `EventOperations`, `EconomyOperations`, `ChatOperations`
- **Shared-living features:** `HouseRuleOperations`, `HouseCheckinOperations`, `HouseCheckinMaintenanceService`, `GuestNoticeOperations`, `MaintenanceTicketOperations`, `KudoOperations`
- **Games:** `PartyGameService` (prompt-relay room state)
- **Gamification/stats:** `StatsService` (XP, levels, streaks, leaderboard periods, achievement definitions; computed on demand)
- **Notifications/realtime:** `NotificationService`, `RealtimeUpdateService`, `InvitationRealtimeService`
- **Calendar:** `CalendarFeedService`, `GoogleCalendarService`, `GoogleOAuthStateService`

### Repositories (`/repository`)
Spring Data JPA interfaces, roughly one per aggregate (Member, Collective, Room, Task, TaskFeedback, TaskSwapRequest, ShoppingItem, Event, Expense, PantEntry, PersonalSettlement, SettlementCheckpoint, ChatMessage, Notification, Achievement, CustomAchievement, Invitation, Friendship, SocialIdentity, HouseRule, HouseCheckin, GuestNotice, MaintenanceTicket, Kudo, PartyGameRoom, TokenEntry, PushDeviceToken).

### Domain entities (`/domain`)
Member, Collective, Room, TaskItem, TaskFeedback, TaskSwapRequest, ShoppingItem, CalendarEvent, Expense, PersonalSettlement, SettlementCheckpoint, PantEntry, ChatMessage, Notification, Achievement, CustomAchievement, Invitation, Friendship, SocialIdentity, HouseRule, HouseCheckin, GuestNotice, MaintenanceTicket, Kudo, PartyGameRoom, TokenEntry (`auth_tokens`), PushDeviceToken (`push_device_tokens`).

### Config (`/config`)
- `SecurityConfig` + `RevokedTokenValidator` — JWT auth, token revocation (revocation list read from PostgreSQL)
- `WebSocketConfig` + `CollectiveWebSocketHandler` — `/ws/collective` live channel per collective
- `WebConfig` (CORS etc.)

### Database (`/resources/db/migration`)
Flyway migrations, **V1 baseline → V57**. `V1` defines the core tables; later migrations layer on features. Core era (selected): task recurrence (V10), penalty XP (V11), notifications (V12–13), chat reactions/polls/images/replies (V14, V15, V18, V31), Google Calendar (V19), monthly prize (V20), task feedback (V21), notification prefs (V23), pant goal (V25), expense deadlines (V26), personal settlements (V27), achievement config (V30), token store (V32, `auth_tokens` — replaced Redis), push device tokens (V33). "Smart assignment" scaffolding spans V4–V9.

Recent feature era (V34–V57):
- **V34** social identities · **V35** prompt-relay rooms · **V36** member color · **V37** collective address
- **V38** task recurrence series · **V39** custom achievements · **V40** friendships
- **V41** member payment handles (Vipps/MobilePay/PayPal/bank) · **V42** task-swap requests
- **V43** house check-ins · **V44** house rules · **V45** guest notices & quiet hours
- **V46** maintenance tickets · **V47** kudos · **V48** maintenance-cost split · **V49** kudo type
- **V50** small-cleaning task category · **V51** student-living improvements · **V52** task history
- **V53** custom achievement icon · **V54** chat message recipient · **V55** performance indexes
- **V56** event attendance (join/pass RSVP)
- **V57** row-level security on every `public` table (see "RLS" below)

**RLS.** Supabase exposes the whole `public` schema through PostgREST, so `V57` enables
row-level security on every table and defines **no policies** — that denies the `anon` /
`authenticated` API roles outright, while the JDBC role that owns the tables still bypasses
RLS, leaving authorization exactly where it already lives (the Kotlin API layer). Kollekt
never calls Supabase directly, so nothing legitimate loses access. **Any new migration that
creates a table must end with `alter table <name> enable row level security;`**, otherwise the
Supabase linter flags it as publicly readable again. Do not add `force row level security` —
it applies policies to the owner too and would break the backend.

---

## Notable design notes / current state

- **Identity by name:** `memberName` is the de-facto key across the API; member names are globally unique.
- **Games are in-app:** UI in `src/games/`, content/engine imported from `othergames/` as source — no external service or API key at runtime. **Exception:** prompt-relay rooms coordinate through `/api/party-game`.
- **No Redis, no Kafka:** tokens live in PostgreSQL, stats are computed on demand; the former Kafka integration events were dropped. WebSockets remain the realtime transport.
- **Task swapping is now live** (V42, `TaskSwapRequestController` / `TaskSwapOperations`), realizing one of the old backlog ideas. **Smart/automatic fair assignment is still scaffolding** — the V4–V9 columns and `assignmentReason` exist but there is no live algorithm consuming chemistry/preferences/fairness scores; tasks are created with an explicit assignee. Still a prime area for future work (see `ideas.md`).
- **Realtime is push-notify-then-refetch:** WS events tell the client *what changed*; the client refetches via REST.
- **Two settlement models:** collective-wide `SettlementCheckpoint` and per-pair `PersonalSettlement`; settle-up can launch the creditor's registered payment links.
- **Auth options:** email/password with self-service reset (emailed token), plus social login via `/onboarding/oauth/{provider}`.

## Infra & ops
- `docker-compose.yml` (root) — **backend + frontend only** (DB is external Supabase via `.env`). No Redis/Kafka. The `othergames/` workspace ships its own `Dockerfile`/`docker-compose.yml` for the legacy standalone server, which the app does not run.
- **Mobile packaging:** committed Capacitor `ios/`/`android/` projects, application ID `no.kollekt.app`. The iOS app targets **iPhone and iPad** (`TARGETED_DEVICE_FAMILY = "1,2"`, all iPad orientations declared). Both native apps call the deployed Kotlin backend over HTTPS/WSS; no backend code is embedded.
- **Mobile layout:** the shared shell accounts for iOS/Android safe-area insets, dynamic viewport height, the fixed bottom nav, and touch devices without hover.
- **Mobile environment:** `npm run mobile:sync` builds in Vite's `mobile` mode and requires `.env.mobile` with the absolute HTTPS backend URL. Local web dev uses `.env` and the `/api` proxy.
- **Google Calendar on mobile:** OAuth opens in the native browser and returns through `no.kollekt.app://google-calendar-connected`; the backend accepts only configured web/native return URLs and stores each OAuth state as a short-lived single-use nonce. A read-only ICS feed is available via `/api/calendar-feed`.
- **Mobile native polish:** status bar and splash are configured in `capacitor.config.ts` and initialised in `src/lib/nativeBootstrap.ts`; icons/splash generated from `assets/` via `@capacitor/assets`; light haptics via `src/lib/haptics.ts`.
- **Push notifications:** client foundation (permission, device-token registration after login, tap deep-links) in `src/lib/pushNotifications.ts`; tokens persisted via `POST /api/push/device-token` (`push_device_tokens` table). Actual APNs/FCM delivery is configured separately.
- `Dockerfile` + `nginx/` — frontend container served by nginx.
- `.github/workflows/ci-cd.yml` — builds frontend + backend on push/PR to `main`, publishes `kollekt-frontend`/`kollekt-backend` images to Docker Hub.
- Tests: backend has broad coverage under `backend/src/test` — `service/*Test`, `api/*ContractTest`, and `acceptance/*` (user-story acceptance tests, mapped in `user-story-test-mapping.md`).

---

## Ideas / backlog (see `ideas.md`)
Smart/fair automatic task assignment (the remaining scaffolding), adaptive recurrence, away/vacation planning, richer analytics, role management, collective goals & rewards, IoT verification, audit trail.
