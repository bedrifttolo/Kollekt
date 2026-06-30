# Kollekt — Remaining Work & Things to Be Aware Of

Companion to [IMPROVEMENTS_PLAN.md](IMPROVEMENTS_PLAN.md). As of 2026-06-26, **all in-repo code work from the plan is done.** What remains is external account setup, a few "flip the switch" steps, one optional refactor, and some things to verify on a real device before shipping.

---

## 1. What's actually left

### A. External account setup (cannot be done from the codebase)

| Item | What you must do externally | Then in the repo |
|------|-----------------------------|------------------|
| **#11 AdMob** | Create a Google AdMob account; get an **App ID** + **ad-unit IDs**. | `npx cap sync` → set real `GADApplicationIdentifier` in `ios/App/App/Info.plist` + `VITE_ADMOB_HOME_BANNER_IOS` / `VITE_ADMOB_HOME_BANNER_ANDROID` → set `VITE_ENABLE_ADS=true` → update `PrivacyInfo.xcprivacy` (see §3). |
| **#12 Game subscription** | App Store Connect: create an **auto-renewable subscription** product (e.g. `kollekt_games_monthly`) + set price. (Recommended: a RevenueCat project.) | `npm i @revenuecat/purchases-capacitor` → implement the 3 stubs in [`src/lib/purchases.ts`](src/lib/purchases.ts) (`fetchEntitlement`/`runPurchase`/`runRestore`) → set `PURCHASES_CONFIGURED = true`. |
| **#9 Direct pay (Vipps/MobilePay)** | Register a **Vipps MobilePay partner** account; get API/SDK credentials. | Current app is legal manual receive-and-settle only: it stores receiving handles, opens external apps, and requires the user to confirm payment happened outside Kollekt. Prefilled/direct payment still needs official partner APIs plus a backend endpoint to mint server-validated payment links. **Blocked on partner account.** |
| **#6 Push delivery** | APNs **Auth Key (.p8)** in the Apple Developer account; configure the backend/Firebase sender. Add the **Push Notifications** capability + **Background Modes → Remote notifications** in Xcode. | Nothing — client is wired. Validate using [`PUSH_TESTING.md`](PUSH_TESTING.md). |

### B. Optional refactor (no user-visible change)

- **#18 `IconButton` primitive** — every interactive control is already ≥44pt inline. Adding a shared `IconButton` (`min-h-11 min-w-11`) to [`src/components/ui-kit/index.tsx`](src/components/ui-kit/index.tsx) and migrating the icon buttons would prevent future regressions. Low priority; say the word and I'll do it.

### C. Deliberate follow-ups (scoped out of the shipped versions)

- **DMs (#19)** are **text-only 1:1**. Not included: images/reactions/replies *inside* DMs, and **group** DMs. The backend blocks reactions/polls/pins/replies on DM messages on purpose.
- **Ads (#11)** ship as a standard **adaptive banner above the nav**. A native ad rendered *inside* the promo slider needs AdMob Native Ads (heavier) — future option.
- **Levels (#8)** has no "progress to next level" UI (just a number) — intentional, noted as optional polish.

---

## 2. Things to be aware of (gotchas & risks)

### Database / migrations
- **DM migration is `V54`**, not the "V50" the early plan guessed — the DB was already at V53. The next new migration is **V55**.
- `V54__add_chat_message_recipient.sql` adds a **nullable** `recipient` column, so all existing chat rows remain household messages. The migration is **forward-only** (Flyway) — there's no automatic rollback. Don't renumber it after it has run anywhere.

### Privacy — the critical DM point
- A direct message must **never** reach the whole household. This is enforced in two places, and both must stay intact if anyone touches chat:
  1. DM realtime goes through `RealtimeUpdateService.publishToMembers(...)` (only the two participants), **not** `publish(...)` (whole collective).
  2. `addReaction`/`removeReaction`/`votePoll`/`togglePin` and reply-references **reject** messages with a non-null `recipient` — otherwise their broadcast would leak DM text.
- If you later add images/reactions to DMs, you must route those events through `publishToMembers` too. **Do not** loosen the guards without replacing them with targeted delivery.

### Apple / App Store review
- **ATT prompt**: once `VITE_ENABLE_ADS=true`, the app shows the App Tracking Transparency prompt. `NSUserTrackingUsageDescription` is already in `Info.plist`. Without an honest description, review will reject.
- **Privacy manifest drift**: today `PrivacyInfo.xcprivacy` declares **no tracking**. The moment ads go live you must set `NSPrivacyTracking=true`, add the tracking domains, and declare `DeviceID` collected *for tracking*. Shipping ads with the current (no-tracking) manifest is a rejection risk.
- **IAP rules don't mix**: game access (#12) **must** use StoreKit IAP; roommate settle-up (#9) **must not** — it's person-to-person real money handled by Vipps/PSP, outside IAP. Swapping these gets you rejected either way.
- **Restore Purchases** is required by Apple and is already in the paywall — keep it when wiring RevenueCat.
- **Privacy Nutrition Labels** in App Store Connect must match the manifest and backend data (name, email, user/device id, photos, user content, optional payment receiving handles/financial info).

### "Inert until configured" flags — don't forget to flip
- [`src/lib/ads.ts`](src/lib/ads.ts): `VITE_ENABLE_ADS = false`
- [`src/lib/purchases.ts`](src/lib/purchases.ts): `PURCHASES_CONFIGURED = false`
- While `false`, premium games are **locked for everyone** and the paywall shows an "unavailable" note. That's expected pre-launch — but it means **no one can play the 6 premium games until the subscription is live.** If you want them open until launch, set the entitlement to treat unconfigured as unlocked, or remove the `requiresSubscription` flags temporarily.

### Premium/free game split (easy to change)
- Free: **Kollekt, 100 Questions, Dice, Spin the Wheel** + Prompt relay, Mexican, Categories.
- Premium: Liars' Dice, Truth or Chug, Never Have I Ever, Kings Cup, Charades, Snusboksen.
- It's just the `requiresSubscription` flag in [`src/games/catalog.ts`](src/games/catalog.ts) — adjust freely; no other code change needed.

### i18n
- New strings were added in **all four** locales (en/no/da/sv): paywall, DM thread labels, GIF labels, etc. If you add more user-facing strings, add all four or the UI falls back to English.

---

## 3. Pre-ship verification checklist (needs a real device / accounts)

- [ ] **DMs end-to-end on two devices**: send a DM, confirm only the recipient receives it and the household thread never shows it; confirm the realtime update and the private notification.
- [ ] **Push**: follow [`PUSH_TESTING.md`](PUSH_TESTING.md) on a real device (push doesn't work in the iOS Simulator for remote APNs).
- [ ] **Ads** (after enabling): ATT prompt appears once; banner clears the bottom nav; privacy manifest updated; test with AdMob **test** ad-unit ids first.
- [ ] **Subscription** (after enabling): StoreKit **sandbox** purchase + **restore** flow; paywall disclosure visible; entitlement unlocks the 6 premium games.
- [ ] **Economy settle-up**: verify on real iOS/Android devices that Vipps/MobilePay/PayPal open externally, bank details copy, the manual-payment acknowledgement gates "mark settled", and no payment is marked settled before the user confirms.
- [ ] **Migration V54** applied cleanly against a copy of production data.
- [ ] Full `npm run typecheck` + backend `./gradlew test` green in CI.

---

## 4. Current verification status (already done)
- `tsc --noEmit` — clean.
- Backend `compileKotlin` — BUILD SUCCESSFUL; `ChatOperationsTest` — passed.
- `plutil -lint` — `Info.plist` + `PrivacyInfo.xcprivacy` OK.
- All four locale JSON files parse.
