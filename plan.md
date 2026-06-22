# Plan — Global Look & Feel Restyle

## 1. Objective & scope

Refresh the **app-wide visual identity** (color palette, typography scale, radius,
density, elevation, navigation chrome) without changing app behavior, routing, copy,
or data flow.

- **Frontend:** primary work, and almost entirely centralized.
- **Backend:** _not required_ — a pure visual restyle touches no Kotlin/API code.
- **Tests:** no frontend test harness exists; backend is untouched. See §6.

### Assumption (confirm or override)
Direction = **evolve the current pine + lemon system toward `kollekt-design-2.html`**
(the existing design mockup), tightening palette, type scale, and density rather than
inventing a new aesthetic. The plan's structure is direction-agnostic: only the token
_values_ in §4.1 change if you want a different palette.

## 2. Why this is centralized (key finding)

The UI is fully **token-driven**:
- All colors/spacing/radii are CSS custom properties in `src/styles/globals.css`
  (`:root` for light, `.dark` for dark), exposed to Tailwind v4 via `@theme inline`.
- Reusable surfaces are semantic classes in the same file's `@layer components`
  (`.card`, `.btn-pine/lemon/ghost`, `.househero`, `.podium`, `.gcard`, `.task`,
  `.event`, `.pill-*`, `.vibe-ring`, `.seg`, `.field`).
- Shared primitives live in `src/components/ui-kit/index.tsx`.
- **There are zero hardcoded hex colors in `src/pages/**` or `src/components/**`** —
  pages compose token-backed Tailwind classes (`bg-card`, `text-primary`, etc.).

⇒ A global restyle is achieved by editing **tokens + component classes in one file**,
not by editing the 12 pages. This is the lowest-risk, highest-leverage approach and the
one this plan uses. Sweeping per-page edits are explicitly out of scope (§5).

## 3. Files touched (and justification)

| File | Change | Why |
|------|--------|-----|
| `src/styles/globals.css` | **Primary.** Update token values (`:root` + `.dark`), `--radius`, `--shadow`, font vars, and `@layer components` class rules. | Single source of truth for the entire visual system. |
| `src/context/ThemeContext.tsx` | Update the **hardcoded status-bar hex** (`#0D1912` / `#F1EEE2`, lines ~20–21) to match new `--background` light/dark values. | These two literals are the _only_ color values that live outside the token file; if the background token changes they must change in lockstep or the native status bar will mismatch. |
| `src/components/ui-kit/index.tsx` | Adjust **only if** a primitive's structure must change (e.g. `VibeRing` sizing, `Fab` shadow). Token-driven classes need no edit. | Avoid touching unless a token change alone can't achieve the look. Treat as conditional. |

No other source files are expected to change. `index.html`, `capacitor.config.ts`, and
`vite.config.ts` are out of scope.

## 4. Concrete changes

### 4.1 Tokens — `src/styles/globals.css` (`:root` and `.dark`)
Adjust as a coordinated set (keep both themes in sync):
- **Palette:** `--primary` (pine), `--secondary` (lemon), `--accent` (sky),
  `--destructive` (berry) and their `-foreground` pairs; `--background`, `--card`,
  `--muted`, `--border`. Reconcile values against `kollekt-design-2.html`.
- **Shape:** `--radius` (currently `1.25rem`) → choose one global value; component
  radii derive from it.
- **Elevation:** `--shadow` (light) and the `.dark` shadow.
- **Type:** `--font-sans` / `--font-display`; if the typeface changes, update the
  Google Fonts `@import` at the top of the file **and** the matching `<link>`/preconnect
  in `index.html` (font wiring only — still within the restyle, flagged here for sync).

### 4.2 Component classes — `src/styles/globals.css` (`@layer components`)
Only where the new direction requires it: `.card` padding/radius, `.btn-*` height &
weight, `.househero/.wallet/.gamehero` gradient, `.vibe-ring` conic-gradient stops,
`.pill-*` tints, `.seg`, `.field`. These propagate everywhere automatically.

### 4.3 Navigation chrome (uses tokens; verify, edit only if needed)
- `src/components/BottomNav.tsx` — uses `bg-sidebar`, `sidebar-primary`, etc.; restyle
  via the `--sidebar-*` tokens in §4.1. Edit the component only if the indicator/shape
  itself must change.
- `src/components/AppHeader.tsx`, `src/components/AppLayout.tsx` — token-backed; same rule.

## 5. Out of scope / do not touch
- No per-page restyling in `src/pages/**` unless a page contains a one-off style that
  the token change can't reach (none found in audit — escalate before editing).
- No new components, abstractions, or refactors.
- No behavior, routing, i18n copy, or API changes.
- No backend changes.

## 6. Tests
- **Frontend:** no test runner is configured (`package.json` has no
  vitest/jest/playwright). There are no frontend tests to update for a visual change.
  - Optional, only if you want it: add a minimal smoke test setup. This is **new
    infrastructure**, outside the restyle's minimal scope — left as an explicit opt-in,
    not assumed.
- **Backend:** unaffected by a visual restyle; the existing Kotlin tests under
  `backend/src/test/**` require no changes.

## 7. Verification
1. `npm run typecheck` — guards the `ThemeContext.tsx` edit.
2. `npm run build` — confirms Tailwind/`@theme` tokens compile.
3. Run the app (`npm run dev`) and visually walk every route: `/`, `/tasks`,
   `/calendar`, `/chat`, `/economy`, `/economy/pant`, `/leaderboard`, `/games`,
   `/games/kollekt`, `/profile`, plus `/login` and `/create-household`.
4. **Toggle light/dark** (Profile → appearance) on each surface; confirm both token
   sets and the native status-bar color match.
5. Check contrast on key pairs (`--foreground`/`--background`,
   `--primary-foreground`/`--primary`, pills, bottom nav).

## 8. Risks & mitigations
- **Status-bar drift:** background token changed but `ThemeContext.tsx` literals not →
  mismatch on device. Mitigation: §3 pairs the edits.
- **Dark-mode regression:** editing only `:root` and forgetting `.dark`. Mitigation:
  change both blocks together; verify in step 7.4.
- **Contrast/accessibility:** new palette failing AA. Mitigation: step 7.5.
- **Font swap weight/flash:** if typeface changes, ensure `@import` + `index.html`
  `<link>` agree on loaded weights.

## 9. Open decision for you
Confirm the **target palette/type direction** (or point me at `kollekt-design-2.html`
as canonical). Once confirmed, the only values that change are the tokens in §4.1.

---

## 10. Implemented — Login/Register screen (first frontend issue)

Rebuilt the auth screen to match the provided light/dark screenshots, plus a
**proper secure password-reset flow** (user-chosen).

### Frontend
- `src/pages/LoginPage.tsx` — rewritten: constant "Welcome home." heading (lemon
  highlight), new tagline, Log in / Register segmented tabs, stacked label fields
  (no icons/eye-toggle), pine "Log in" / lemon "Create account" buttons, platform-aware
  social buttons (iOS: Google+Apple, Android/web: Google — existing `socialAuth` logic),
  register terms line, "New build · v0.1" footer, and a **Forgot password?** view
  (email entry → request endpoint). Removed the decorative blobs and the pre-login
  language switcher to match the design.
- `src/components/ui-kit/index.tsx` — added shared `Field` (label + input, reuses the
  token-driven `.field` class), used by login and reset pages.
- `src/pages/ResetPasswordPage.tsx` (new) + public route `/reset-password` in
  `src/App.tsx` — reads `?token=`, sets a new password via the confirm endpoint.
- `src/i18n/locales/{en,no}.json` — new `auth.*` keys (tagline, heading, labels,
  placeholders, forgot/reset copy, terms, build label).

### Backend (secure reset flow; reuses existing `auth_tokens` table — no migration)
- `TokenStoreService` — `storePasswordResetToken` / `consumePasswordResetToken`
  (single-use, time-limited, stores **SHA-256 hash** of the token).
- `PasswordResetService` (new) — request (silent on unknown email → no enumeration) +
  confirm (8-char min, generic invalid-token error). Token is random 32 bytes.
- `PasswordResetMailer` (new) — builds `${app.frontend-url}/reset-password?token=…`.
- `OnboardingController` — `POST /api/onboarding/password-reset/{request,confirm}`,
  added to `SecurityConfig` permitAll. Config: `app.frontend-url`,
  `app.password-reset.token-validity-seconds`.
- Tests: `PasswordResetServiceTest` (new), reset cases added to `TokenStoreServiceTest`,
  and `passwordResetService` mock added to the three `@WebMvcTest` slices.

### Verified
`npm run typecheck` ✓, `npm run build` ✓, `./gradlew test` ✓ (full suite).

### ⚠️ Remaining to go live
1. **Email transport is not wired** — `PasswordResetMailer` currently *logs* the reset
   link (dev-safe, no secrets). To deliver real email, add `spring-boot-starter-mail` +
   `spring.mail.*` config and send from `sendResetLink`.
2. **Native deep-linking** — the reset link targets the web route. For an external email
   client to open the installed app, configure universal links / a custom scheme.
3. **Terms link** is presentational (no `/terms` page exists yet).
