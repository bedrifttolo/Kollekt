# Kollekt — Full Frontend Rebrand Plan

> **Status: PLAN ONLY. Do not implement from this document.** It is the blueprint for a
> later, staged execution. The HTML baseline (`kollekt-design-2.html`) is a *visual* reference —
> it deliberately shows only a subset of screens and **none** of the real logic, data, or
> API wiring. The contract below is: **adopt the new look, lose zero functionality.**

---

## 1. Objective & non-negotiable guardrails

**Goal:** Re-skin the entire React frontend to the new "warm paper + pine/lemon/sky/berry"
design system shown in `kollekt-design-2.html`, while:

1. **Preserving every existing feature and every API endpoint** (full inventory in §6). The
   baseline mockup is NOT the source of truth for features — the current `src/` is.
2. **Adding** a real **Vibe score** tracker (new; §7) surfaced on Home.
3. **Reworking Login** to 2 fields + social sign-in (Google / Apple / Android) (§8).

**Guardrails (do not violate):**
- Re-skin is **presentation-only** unless a step is explicitly listed as logic/back-end work
  (only §7 Vibe and §8 Social-auth touch logic/back-end). Everything else changes JSX/CSS/tokens,
  not data flow.
- Keep all routes in `src/App.tsx`, all `api.*` calls, all i18n keys, all WebSocket/realtime
  wiring, all Capacitor native calls intact.
- Work **token-first, then page-by-page**, one page per PR, each verified against §6 before moving on.
- Run `npm run typecheck` + `npm run build:mobile` after every page (the gate already used in this repo).
- No new heavy UI dependency. The old shadcn/Radix stack was removed; the app is built from
  raw Tailwind + `framer-motion` + `lucide-react`. Stay on that stack.

---

## 2. The reusable rebrand prompt (give this per page, later)

> **Prompt template — fill in `{PAGE}` and paste one page's §6 row with it:**
>
> "You are re-skinning **only** `src/pages/{PAGE}` to the Kollekt design system defined in
> `src/styles/globals.css` (the new tokens) and mirrored in `kollekt-design-2.html`. This is a
> **visual change only**. Constraints:
> 1. Do **not** add, remove, or rename any `api.*` call, prop, state variable, effect, handler,
>    realtime subscription, or navigation target. Diff the data layer to zero.
> 2. Every feature listed for this page in `plan.md §6` must still be reachable and functional —
>    check each box before you finish.
> 3. Replace only `className`s, wrapper markup, icons, and copy structure to match the new
>    components (`.card`, `.btn-pine/.btn-lemon/.btn-ghost`, `.pill-*`, `.eyebrow`, `.househero`,
>    `.seg`, etc.). Use the CSS variables, never hard-coded hex.
> 4. Keep all `t('…')` i18n keys; add new keys to BOTH `en.json` and `no.json` if copy changes.
> 5. Support **light and dark** via the `.dark` class tokens — do not hard-code a single theme.
> 6. End by running `npm run typecheck` and reporting which §6 features you verified."

---

## 3. Design system: old → new (token swap is the foundation)

The entire rebrand pivots on rewriting `src/styles/globals.css` tokens ONCE, so most pages
re-theme for free. Map:

| Concept | Current (`globals.css`) | New (from baseline) |
|---|---|---|
| Theme | dark-only, `hsl(228 40% 6%)` bg | **light default** `#F1EEE2` paper + **dark** `#121B15`; both via `.dark` |
| Primary | cyan `hsl(185 100% 50%)` | **pine** `#1F4A36` (dark: `#2C5C43`) |
| Accent/CTA | orange `hsl(33 100% 64%)` | **lemon** `#EFC64B` |
| Info | — | **sky** `#7FA7C9` |
| Alert/owe | `--destructive` red | **berry** `#B24A66` |
| Surface | `--card` glass | `--surface #FBFAF1`, `--surface-2 #E7E2D2` |
| Body font | Inter | **Schibsted Grotesk** |
| Display font | Space Grotesk | **Bricolage Grotesque** (`.h-disp`, `.title-l`) |
| Radius | `1rem` | cards `22px`, pills `100px`, phones rounded |
| Signature motif | `text-gradient` | **highlighter `.mark`** (lemon underline swipe) + **roof** eyebrow icon |

**Concrete token tasks (one PR):**
1. Replace `:root` token block with the **light** palette; add a `.dark { … }` block with the
   dark palette (both already enumerated in the baseline's `.app` / `.app.dark` token lists).
2. Swap `--font-sans` → Schibsted Grotesk, `--font-display` → Bricolage Grotesque; add the
   Google Fonts `<link>` to `index.html` (preconnect + the two families from the baseline `<head>`).
3. Add the new utility classes from the baseline as real CSS (or Tailwind components):
   `.mark`, `.eyebrow`, `.roof`, `.card`, `.pill-*`, `.btn-*`, `.seg`, `.househero`, `.vibe/.ring`,
   `.bignum`, `.wallet`, `.podium`, `.gamehero`, `.task/.check`, `.event`, `.msg/.bub`, `.field`.
4. Introduce a minimal **theme controller**: `next-themes` was removed in cleanup, so add a tiny
   `ThemeProvider` (React context + `localStorage` + toggling `document.documentElement.classList`),
   plus sync to Capacitor `@capacitor/status-bar` style. Wire the Profile → Appearance toggle.
5. Replace the brand mark: reuse the K-house SVG from the baseline (`BRAND` const) for header/auth.
   App icons/splash/favicon are already done — do **not** touch `assets/` or native icon files.

> After step 1–3, every page will already look ~60% rebranded because they consume tokens.
> The per-page work in §6 is then mostly structural cleanup, not color-by-hand.

---

## 4. Component layer (build once, reuse across pages)

Create small presentational components under `src/components/ui-kit/` (new, app-specific —
NOT the old shadcn set) to encode the baseline patterns once:
- `Card`, `Eyebrow` (roof + label), `Pill` (variant: pine/sky/lemon/berry), `Button`
  (pine/lemon/ghost), `Segmented` (the `.seg` toggle), `StatTile`, `Avatar`/`AvatarStack`,
  `ProgressBar`, `VibeRing` (§7), `Fab`, `BottomNav` (restyle existing).
- These wrap raw markup + tokens; they hold **no business logic**. Pages keep their own data/handlers.

---

## 5. Navigation reconciliation (one decision to make before coding)

- **Current app has 7 bottom-nav tabs** (`src/components/BottomNav.tsx`): Home, Tasks, Calendar,
  Chat, Economy, **Board (/leaderboard)**, **Games (/games)**.
- **Baseline shows 6 tabs**: Home, Tasks, Calendar, Chat, Economy, **Board** — with **Games as a
  tab *inside* Board** (`Ranks | Games` segmented control), matching the existing `LeaderboardPage`.
- **Plan:** keep all routes (`/games`, `/games/kollekt`, `/leaderboard`) but present Games as a
  segment within the Board screen per the baseline, and **drop the standalone Games tab from the
  bottom bar** (route stays reachable via the Board segment + deep links). 6-tab bar = baseline.
  → This loses no feature; it only relocates the entry point. Confirm with product before building.

---

## 6. FEATURE + ENDPOINT INVENTORY — the "lose nothing" contract

Re-skin each page only after checking off every item here. Endpoints are the literal paths the
page calls today; they must remain unchanged.

### `LoginPage.tsx` → rework in §8
- login (`POST /onboarding/login`), register (`POST /onboarding/users`), auto-join via invite
  (`GET /invitations`, `POST /onboarding/collectives/join`), language switcher, show/hide password.

### `CreateHouseholdPage.tsx` (onboarding)
- Create collective `POST /onboarding/collectives`; join by code `POST /onboarding/collectives/join`;
  rooms→XP setup; `GET /onboarding/me`. Baseline "Onboarding" screen maps here.

### `DashboardPage.tsx` (Home)
- `GET /dashboard?memberName=` → name, XP, level, rank, completedTasksCount, balance,
  upcomingTasks, upcomingEvents, recentExpenses, pendingShoppingItems.
- Quick actions, activity feed, member/online stats, **+ new Vibe ring (§7)**.

### `TasksPage.tsx` (largest — 1242 lines; audit carefully)
- List/create/edit/delete tasks (`GET/POST /tasks`, `PATCH/DELETE /tasks/{id}?memberName=`),
  toggle complete (`/tasks/{id}/toggle`), regret/late (`/tasks/{id}/regret`,
  `/tasks/{id}/regret-missed`), task feedback w/ image (`/tasks/{id}/feedback`), recurrence rules,
  XP + penalty XP, rotation banner.
- **Restock / shopping** segment: `GET/POST /tasks/shopping`, toggle `/tasks/shopping/{id}/toggle`,
  mark bought + split `/tasks/shopping/{id}/bought`, edit/delete `/tasks/shopping/{id}`.

### `CalendarPage.tsx`
- Events CRUD `GET/POST /events`, `PATCH/DELETE /events/{id}`; month grid; day agenda; attendees;
  event types/colors; **Google Calendar**: `/google-calendar/auth-url`, `/status`, `/disconnect`
  (+ `googleCalendarOAuth.ts`, mobile return URL). Preserve all of this.

### `ChatPage.tsx`
- Messages `GET/POST /chat/messages`; images `POST /chat/images`; reactions
  `/chat/messages/{id}/reactions`; polls `POST /chat/polls` + vote `/chat/messages/{id}/poll/vote`;
  reply-to; **realtime** via `realtime.ts` WebSocket. Baseline chat screen maps here.

### `EconomyPage.tsx`
- `GET /economy/summary`, balances, expenses CRUD `GET/POST /economy/expenses`,
  `PATCH/DELETE /economy/expenses/{id}`; settle `POST /economy/settle-with`,
  pay-options `/economy/pay-options`; recent activity; link to Pant.

### `PantTrackerPage.tsx`
- `GET/POST /economy/pant`, edit/delete `/economy/pant/{id}`, goal `/economy/pant/goal`;
  progress to goal. Surfaced as a card in Economy in the baseline.

### `LeaderboardPage.tsx` (Board)
- `GET /leaderboard?period=` (period switch), podium, `GET /monthly-prize`,
  achievements `GET /achievements`, `/achievements/catalog`, `/achievements/config`;
  member stats `GET /members/stats`. **Games segment lives here (§5).**

### `GamesPage.tsx` + `CollektGamePage.tsx`
- Separate **Games service** (`gamesApi.ts`, `VITE_GAMES_API_URL` + key): `GET /games`,
  `GET /games/{id}` with `langQuery`; full Collekt game engine (rounds, presets, players, stats).
  Re-skin to `.gamehero/.gamegrid/.gcard`; **do not touch the game engine logic**.

### `ProfilePage.tsx` (675 lines)
- Profile + stats, household code (copy), invite roommates `POST /members/invite`,
  members list `GET /members/collective`, friends add/remove `/members/friends/*`,
  status `POST /members/status`, notifications prefs `GET/PATCH /notifications/preferences`,
  reset password `POST /members/reset-password`, leave `POST /members/leave-collective`,
  delete account `/members/delete`, logout (`logoutSession`), **language toggle**,
  **+ new theme (light/dark) toggle (§3.4)**.

### App-wide / cross-cutting (must keep working through the reskin)
- `AppLayout.tsx`, `AppHeader.tsx`, `BottomNav.tsx`, `LanguageSwitcher.tsx`.
- Auth/session: token refresh, `authStorage`, guards in `App.tsx`.
- Notifications: `GET /notifications/{user}`, read/delete, **push** (`pushNotifications.ts`,
  `POST /push/device-token`).
- Native: `nativeBootstrap.ts`, `haptics.ts`, splash/status-bar, `@capacitor/*`.
- i18n: `en.json` / `no.json` must stay in sync for any copy change.

---

## 7. NEW FEATURE — Vibe score tracker

The baseline Home shows a **Vibe ring (e.g. "84")** with a one-line reason. It does not exist yet.

**Definition (derive server-side; deterministic, explainable):**
- Compute a 0–100 collective "Vibe" from signals already in the DB, e.g. weighted blend of:
  task completion rate this week, overdue/penalty count, outstanding balances spread,
  recent activity/streaks. (The `Member.chemistry` column already exists and is the natural
  home for per-member inputs — reuse, don't reinvent.)

**Backend (new, minimal):**
1. Add `vibeScore: Int` (+ optional `vibeLabel`/`vibeReason: String`) to `DashboardResponse`
   in `ApiModels.kt` and compute it in `StatsService` (the dashboard already aggregates the
   needed counts). No new endpoint required — extends the existing `GET /dashboard`.
2. Add a Flyway migration only if a stored history/trend is wanted (e.g. `collective_vibe_history`)
   for a sparkline; otherwise compute on the fly (preferred for v1).
3. Cover with a `StatsServiceTest` case.

**Frontend:**
1. Extend the dashboard response type in `src/lib/types.ts` with `vibeScore` (+ label/reason).
2. Build `VibeRing` component (conic-gradient ring per baseline `.ring`) in the ui-kit.
3. Place it on `DashboardPage` exactly where the baseline `.vibe` block sits.
4. i18n keys for label/reason in `en.json` + `no.json`.

> Vibe is the only place the rebrand adds real data flow on the read path — keep it isolated to
> dashboard so it can't regress other screens.

---

## 8. NEW — Login rework (2 fields + social sign-in)

**Target (baseline auth screen):** two fields (Email, Password) + "continue with
Google / Apple" social buttons, register as a secondary panel.

**Frontend:**
1. Collapse the login form to exactly **2 fields**. NOTE: today login posts `{ name, password }`
   to `/onboarding/login` (username, not email). **Decision needed:** either (a) allow
   email-or-username in the existing field, or (b) add backend support for email login. Pick (a)
   for a pure-frontend v1 unless product wants email-only. Register keeps name/email/password.
2. Add social buttons wired to native plugins (see below), with web fallbacks.
3. Keep invite auto-join (`tryJoinFromInvitation`) and post-login routing untouched.

**Social auth (this is real platform + backend work — scope it explicitly):**
- **Google & Apple:** add a Capacitor social-auth plugin (e.g. `@capgo/capacitor-social-login`
  or platform SDKs). Apple "Sign in with Apple" is **mandatory** by App Store rules if any other
  social login is offered — include it.
- **"Android"** = Google Sign-In on Android (same Google flow), not a separate provider.
- **Backend:** add a token-exchange endpoint (e.g. `POST /onboarding/oauth/{provider}`) that
  verifies the provider ID token and returns the same `AuthResponse` (access/refresh) shape, so
  the rest of the app is unchanged. Requires Google/Apple client IDs in the consoles
  (handoff items, like the existing publish checklist).
- Reuse the existing `googleCalendarOAuth.ts` patterns for the native browser/redirect handling.
- This sub-project has its own credentials + backend + store-config dependencies — treat §8 social
  as a **separate milestone** that can ship after the visual rebrand.

---

## 9. Execution order (staged, each step independently shippable)

1. **Tokens & fonts** (§3.1–3.3) — global CSS + `index.html` fonts. Visual smoke-test only.
2. **Theme controller** (§3.4) + Profile appearance toggle.
3. **ui-kit components** (§4).
4. **BottomNav restyle + nav reconciliation** (§5).
5. **Per page, in this order** (low-risk → high-risk), one PR each, verified vs §6:
   Profile → Economy → Pant → Calendar → Board(+Games segment) → Chat → Home → **Tasks (last; biggest)**.
6. **Games/Collekt** re-skin (engine untouched).
7. **Vibe score** (§7) — backend + Home.
8. **Login rework** (§8 frontend) → then **Social auth** (§8 milestone).

## 10. Verification gate (run after every step)
```bash
npm run typecheck
npm run build:mobile
# backend (only when §7/§8 touch it):
cd backend && ./gradlew build && cd ..
```
Plus a manual pass of the changed page's §6 checklist (light AND dark), and `npm run mobile:sync`
before a device check.

---

## 11. Open decisions to confirm before building
1. **Nav:** collapse Games into the Board screen (6-tab bar) per baseline? (§5)
2. **Default theme:** baseline is **light-first** — make light the default (current app is dark-only)?
3. **Login identifier:** email-or-username field (frontend-only) vs add email-login backend? (§8.1)
4. **Social providers for v1:** Google + Apple now, or defer social to a post-rebrand milestone?
5. **Vibe:** compute on-the-fly (v1) vs store history for a trend sparkline? (§7.2)
