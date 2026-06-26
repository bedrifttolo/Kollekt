# Kollekt — Implementation Plan

Status snapshot as of 2026-06-26. Completed items are summarized; only **remaining** work is kept in full detail.

---

## ✅ Completed

| # | Item | What shipped |
|---|------|--------------|
| 1 | FAB overlaps bottom nav | FAB anchored to `calc(env(safe-area-inset-bottom) + 6.5rem)` in [`ui-kit/index.tsx:83`](src/components/ui-kit/index.tsx#L83). |
| 2 | Per-author chat bubble colors | `senderColor = colorForMember(sender, memberColorMap.get(sender))` on name + bubble accent; self stays primary ([`ChatPage.tsx:405`](src/pages/ChatPage.tsx#L405)). |
| 3 | Chat touch targets ≥44pt | All `h-6/h-8` chat controls enlarged (no sub-44pt controls remain in ChatPage). |
| 4 | Input extends on tap | `inputFocused` state drives the toolbar; renders on `inputFocused || !input.trim()` ([`ChatPage.tsx:59`](src/pages/ChatPage.tsx#L59),[`:649`](src/pages/ChatPage.tsx#L649)). |
| 5 | GIF support (bundled) | `STARTER_GIFS` picker, sent via existing image path — no backend change ([`ChatPage.tsx:27`](src/pages/ChatPage.tsx#L27)); labels in en/no/da/sv. |
| 6 | Push verification | [`PUSH_TESTING.md`](PUSH_TESTING.md) runbook + `VITE_DEBUG_PUSH` opt-in logging ([`pushNotifications.ts:10`](src/lib/pushNotifications.ts#L10)). |
| 7 | Task expiry "5 days" | **Decision: keep "5 days after due date"** — no code change; XP already preserved via `TaskHistoryEntry` + lifetime `Member.xp`. |
| 8 | Levels | `levelForXp(xp)` helper centralizes `xp/200+1`, reused on completion + penalty ([`TaskOperations.kt:302`](backend/src/main/kotlin/com/kollekt/service/TaskOperations.kt#L302)). Verified not broken. |
| 10 | Apple pre-submission (in-repo) | Privacy manifest + required-reason APIs (`CA92.1`/`C617.1`/`E174.1`/`35F9.1`) in [`PrivacyInfo.xcprivacy`](ios/App/App/PrivacyInfo.xcprivacy); `ITSAppUsesNonExemptEncryption=false`; camera/photo strings present; account deletion confirmed. |
| 13 | Long-press chat menu | Pointer-based press-and-hold opens reply/react menu ([`ChatPage.tsx:90`](src/pages/ChatPage.tsx#L90),[`:440`](src/pages/ChatPage.tsx#L440)). |
| 14 | Calendar week nav bug | `prevWeek`/`nextWeek` shift the selected date by ±7 days ([`CalendarPage.tsx:125`](src/pages/CalendarPage.tsx#L125)). |
| 15 | Dashboard tap targets | "Se alle" links given `min-h-11` padded hit areas ([`DashboardPage.tsx:233`](src/pages/DashboardPage.tsx#L233)). |
| 16 | Pant tap targets | Controls raised to `h-11 w-11` / `h-9 w-9` ([`PantTrackerPage.tsx`](src/pages/PantTrackerPage.tsx)). |
| 17 | Prize save-form X overlap | `showPrize` edit branch restructured so X no longer overlaps Save ([`RanksPanel.tsx:220`](src/pages/social/RanksPanel.tsx#L220)). |
| 20 | Avatar color propagation | `AvatarStack` now takes `Array<{name, color}>` and passes color to each `Avatar` ([`ui-kit/index.tsx:61`](src/components/ui-kit/index.tsx#L61)); call sites pass member colors. |
| 21 | Calendar event emojis fit | Event-type row is now `flex flex-wrap` ([`CalendarPage.tsx:407`](src/pages/CalendarPage.tsx#L407)). |
| 22 | Standardized add forms | Shared `AddSheet` primitive ([`ui-kit/index.tsx:43`](src/components/ui-kit/index.tsx#L43)); Tasks/Calendar/Chat create sheets migrated (submit logic unchanged). |
| 23 | Reaction picker overlay | Full reaction set in a centered dimmed overlay, no scroll ([`ChatPage.tsx:737`](src/pages/ChatPage.tsx#L737)). |
| 24 | Game "how it works" | `ruleText.<key>` per game + ⓘ rules sheet in [`GamesPanel.tsx:156`](src/pages/social/GamesPanel.tsx#L156). |
| 25 | Laundry auto-message | Simplified to "Doing a {{temp}}°C wash ({{type}}). Join in?" across locales — no emoji / "save power" ([`en.json:450`](src/i18n/locales/en.json#L450)). |

**#18 (general tappability)**: the *goal* — every interactive control ≥44pt — is met inline across Chat, Pant, Dashboard, Calendar, and the prize form (items #3/#15/#16/#17). The proposed shared `IconButton` abstraction was **not** created; it's an optional future refactor (low value now that the offenders are fixed), tracked below.

---

## Remaining work

Everything below is either **external/product setup** (needs accounts or a decision I can't make from the repo) or **needs a scope decision before building**.

### #9 — Direct pay (Vipps MobilePay partner deep-link)  · *external*
Phase 1 decided: hand off to Vipps with amount + recipient prefilled (funds don't flow through Kollekt). **Blocked on**: registering a Vipps MobilePay **partner account** and adding their SDK/API. Code touch-points when unblocked: link construction in [`paymentLinks.ts:24`](src/lib/paymentLinks.ts#L24), the pay sheet in [`EconomyPage.tsx:145`](src/pages/EconomyPage.tsx#L145), and a backend endpoint to mint server-validated payment links. *Cannot be completed in-repo without the partner credentials.*

### #18 — Shared `IconButton` primitive  · *optional refactor*
Goal already met inline (every interactive control is ≥44pt). If desired, add `IconButton` (`min-h-11 min-w-11`) to [`ui-kit/index.tsx`](src/components/ui-kit/index.tsx) and migrate existing icon buttons to prevent future regressions. Low priority — pure cleanup, no user-visible change.

---

## ✅ Built since (2026-06-26) — code done, external setup pending

### #11 — AdMob ads  · *code scaffolded, inert until AdMob account*
Decision: **AdMob programmatic**. Built (inert until enabled):
- [`src/lib/ads.ts`](src/lib/ads.ts) — `ADS_ENABLED` flag, `initializeAds()` (ATT + SDK init), `showHomeBanner()`/`hideHomeBanner()`. No-ops until `ADS_ENABLED = true`. Plugin import deliberately omitted so the build doesn't depend on an uninstalled package.
- Init wired in [`nativeBootstrap.ts`](src/lib/nativeBootstrap.ts); home banner show/hide on the Dashboard ([`DashboardPage.tsx`](src/pages/DashboardPage.tsx)).
- iOS [`Info.plist`](ios/App/App/Info.plist): `NSUserTrackingUsageDescription` + `SKAdNetworkItems` added (`plutil` valid).
- **To go live**: `npm i @capacitor-community/admob` → set real `GADApplicationIdentifier` in Info.plist + ad-unit ids in `ads.ts` → set `ADS_ENABLED = true` → uncomment the plugin calls → update `PrivacyInfo.xcprivacy` (`NSPrivacyTracking=true` + DeviceID-for-tracking + tracking domains). A native-ad rendered *inside* the slider is a heavier future option; the shipped placement is a standard adaptive banner above the nav.

### #12 — Game subscription  · *code done, inert until App Store product*
Decision: half the games premium; **Kollekt, 100 Questions, Dice, Spin the Wheel free**. Built:
- `requiresSubscription` flag in [`catalog.ts`](src/games/catalog.ts) — premium: Liars' Dice, Truth or Chug, Never Have I Ever, Kings Cup, Charades, Snusboksen (6/13). Free: the four named + Prompt relay, Mexican, Categories.
- [`src/lib/purchases.ts`](src/lib/purchases.ts) — `useGamesSubscription()` hook + `isGameLocked()`; `PURCHASES_CONFIGURED=false` keeps it inert.
- [`GamesPanel.tsx`](src/pages/social/GamesPanel.tsx) — lock badge, "Unlock" button, paywall sheet (Subscribe + Restore + Apple-required disclosure), launch gated. Strings in en/no/da/sv.
- **To go live**: create the auto-renewable product in App Store Connect, install RevenueCat (`@revenuecat/purchases-capacitor`), implement the three stubs in `purchases.ts`, set `PURCHASES_CONFIGURED=true`. Premium/free split is just flags in `catalog.ts` — adjust freely.

### #19 — Private 1:1 DMs  · *built*
Decision: **1:1 only**. Built and verified (backend compiles, chat tests pass, tsc clean):
- Schema: `recipient` column on `chat_messages` via [`V54__add_chat_message_recipient.sql`](backend/src/main/resources/db/migration/V54__add_chat_message_recipient.sql) + `ChatMessage.recipient`.
- Read: household `getMessages` now excludes DMs (`recipient IS NULL`); `getDirectMessages(member, other)` returns the pair thread, authorized to collective members ([`ChatOperations.kt`](backend/src/main/kotlin/com/kollekt/service/ChatOperations.kt)).
- Write: `createDirectMessage` + `POST /chat/direct`, `GET /chat/direct` ([`ChatController.kt`](backend/src/main/kotlin/com/kollekt/api/ChatController.kt)).
- **Privacy**: DM events use `RealtimeUpdateService.publishToMembers` (targets only the two participants, never the household); reactions/polls/pins/replies are blocked on DM messages so they can never broadcast DM text to the collective; recipient notified privately.
- Frontend: thread switcher (Household + per-member chips) + DM-aware header + thread-scoped fetch/send + targeted realtime in [`ChatPage.tsx`](src/pages/ChatPage.tsx); DMs are text-only (image/poll/laundry/kudos hidden, long-press disabled). Strings in en/no/da/sv.
- **Scope note**: v1 is text-only 1:1. Images/reactions/replies *within* DMs and group DMs are deliberate follow-ups, not shipped.

---

## Decisions needed to unblock the rest
1. **#9** — Vipps MobilePay partner onboarding (external account) to wire the prefilled deep-link.
2. **#11 / #12** — external account setup only (AdMob app id; App Store Connect product + price) — code is ready and inert.
