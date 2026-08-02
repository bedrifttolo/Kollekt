# RevenueCat lifetime unlock — setup guide

Everything code-side is done: RevenueCat's Capacitor SDK is installed, wired up, and the
paywall (game hub + chat GIFs) now sells a **one-time, non-consumable "lifetime unlock"**
instead of a subscription. The app itself stays **free to download**; this is a single
29 kr in-app purchase.

What's left can only be done by you, in the Apple Developer / App Store Connect and
RevenueCat dashboards, because both require your account credentials and legal/tax
identity. Follow this in order — each part depends on the one before it.

Key identifiers used in the code (must match exactly what you create below):

| What | Value |
|---|---|
| Bundle ID | `no.kollekt.app` |
| In-App Purchase Product ID | `kollekt_lifetime_unlock` |
| RevenueCat Entitlement ID | `premium_lifetime` |
| Product type | **Non-Consumable** (one-time purchase, not auto-renewable) |
| Price | 29 kr (Norway storefront) |

---

## Part 1 — Apple Developer / App Store Connect

### 1.1 Accept the Paid Applications Agreement
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Business** (or **Agreements, Tax, and Banking**).
2. Accept the **Paid Applications Agreement** if it's not already active.
3. Fill in **Tax forms** and **Banking information**. Apple will not let a paid IAP go live in production until this is complete (sandbox testing works without it).

This can take Apple a day or two to process — do this first so it's not the bottleneck.

### 1.2 Create the in-app purchase product
1. App Store Connect → **My Apps** → **Kollekt** → **Monetization** → **In-App Purchases**.
2. Click **+** → **Non-Consumable**.
3. **Reference Name** (internal only, e.g. `Lifetime Unlock`).
4. **Product ID**: enter exactly `kollekt_lifetime_unlock`.
5. **Price Schedule** → pick a starting price point. Apple prices by price tier per storefront, not an exact decimal — pick the tier whose Norway (NOK) price is 29,00 kr. If none lines up exactly, pick the closest tier and then use **Manage prices in additional countries or regions** → **Norway** to set that storefront's price explicitly to 29,00 kr (other storefronts can stay at whatever the tier auto-generates).
6. **Localizations** → add at least one (English is required). Add a **Display Name** (e.g. "Lifetime Unlock") and **Description** (e.g. "Unlocks the full game hub and GIFs in chat, forever."). Since the app ships in English, Norwegian, Swedish and Danish, add all four localizations here too so App Store shoppers see it in their language.
7. **Review Screenshot**: upload a screenshot of the in-app paywall (the sheet with the "Unlock for 29 kr" button — you can screenshot it from the simulator once you've built the app with a RevenueCat key, see Part 3). Apple requires this for the *first* IAP submission.
8. Save. The IAP status will show "Missing Metadata" until screenshot + all localizations are filled in, then it becomes "Ready to Submit".

A new IAP is submitted for review together with your next app binary submission (or you can submit it standalone once the app has shipped at least once). You don't need to do that yet — just get it to "Ready to Submit" for now; RevenueCat sandbox testing works before Apple approves it.

### 1.3 Confirm the app itself is free
App Store Connect → **Kollekt** → **Pricing and Availability** → confirm the app's own price is **Free**. (The 29 kr charge only happens through the in-app purchase, not at download.)

### 1.4 Get RevenueCat a way to read your App Store transactions
RevenueCat needs one of these two credentials to verify purchases against Apple. The **shared secret** is quicker; the **In-App Purchase Key** is what Apple/RevenueCat now recommend (also enables real-time Server Notifications, so entitlements update within seconds instead of on next app open).

**Option A — App-Specific Shared Secret (simplest):**
1. App Store Connect → **Kollekt** → **App Information** → scroll to **App-Specific Shared Secret** → **Generate**.
2. Copy the secret — you'll paste it into RevenueCat in Part 2.

**Option B — In-App Purchase Key (recommended):**
1. App Store Connect → **Users and Access** → **Integrations** tab → **In-App Purchase** → **Generate In-App Purchase Key**.
2. Name it (e.g. "RevenueCat"), download the `.p8` file **once** (Apple won't let you re-download it), and note the **Key ID** and **Issuer ID** shown next to it.
3. Keep the `.p8` file somewhere safe — you'll upload it to RevenueCat in Part 2.

Either works fine for a first launch; you can add Option B later without redoing anything if you start with A.

### 1.5 Create a sandbox tester (for testing before going live)
App Store Connect → **Users and Access** → **Sandbox** → **Testers** → **+**. Create a test Apple ID (use an email you don't already use for a real Apple ID, e.g. `yourname+sandbox@gmail.com`). You'll sign into this account on-device to test purchases without being charged real money.

---

## Part 2 — RevenueCat dashboard

### 2.1 Create the project
1. Sign up / log in at [app.revenuecat.com](https://app.revenuecat.com).
2. Create a new **Project** (e.g. "Kollekt").

### 2.2 Add the iOS app
1. Inside the project → **Project Settings** → **Apps** → **+ New app**.
2. Platform: **Apple App Store**.
3. **Bundle ID**: `no.kollekt.app`.
4. Paste in the credential from step 1.4 — either the **App-Specific Shared Secret** or the **In-App Purchase Key** (`.p8` + Key ID + Issuer ID), depending which you generated.
5. Save.

### 2.3 Create the product
1. **Products** → **+ New** → select the app you just added.
2. RevenueCat will try to pull in `kollekt_lifetime_unlock` from App Store Connect automatically (it may take a few minutes after step 1.2 before it shows up — refresh if it's not there yet). Select it, or enter the Product ID manually: `kollekt_lifetime_unlock`.

### 2.4 Create the entitlement
1. **Entitlements** → **+ New**.
2. **Identifier**: `premium_lifetime` (must match exactly — this is what the app checks).
3. Attach the `kollekt_lifetime_unlock` product to this entitlement.

### 2.5 Create the offering + package
1. **Offerings** → **+ New offering** (or use the default `default` offering RevenueCat creates automatically).
2. Mark it **Current** (the app fetches whatever offering is marked current).
3. Inside the offering, **+ New package** → package type **Lifetime** (or **Custom** if "Lifetime" isn't offered) → attach the `kollekt_lifetime_unlock` product.

The app always purchases the *first available package* in the current offering, so make sure this offering contains only the lifetime package (don't add other products to it later without also updating the paywall UI, which currently assumes a single package).

### 2.6 Get your public API key
**Project Settings** → **API Keys** → copy the key listed under **Apple App Store** (it starts with `appl_`). This is a public/client key — safe to embed in the app build, not a secret.

---

## Part 3 — Wire the key into the app and test

1. Open [.env.mobile](.env.mobile) in the repo root and set:
   ```
   VITE_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
2. Rebuild and sync the iOS project:
   ```bash
   npm run mobile:sync
   ```
3. Open the project in Xcode (`npx cap open ios`), pick your Development Team under **Signing & Capabilities**, and run it on a simulator or device.
4. On the device/simulator, sign out of your real Apple ID in **Settings → App Store** and sign in with the **sandbox tester** from step 1.5 (on iOS 18+ simulators you can instead pick the sandbox account directly from the StoreKit test menu when the purchase sheet appears).
5. In the app, open **Chat → GIF picker** (or a game tile once one is un-hidden) to trigger the paywall, and tap the unlock button. You should see Apple's sandbox purchase sheet with the price you configured. Complete it — no real charge occurs.
6. Confirm the GIF picker / game unlocks immediately after purchase.
7. Log out and back in (or reinstall) and tap **Restore purchases** on the paywall — confirm it re-unlocks without a new charge. This is required by App Store Review for every non-consumable IAP.
8. In the RevenueCat dashboard, check **Customers** — you should see a customer with App User ID equal to your Kollekt member name, with the `premium_lifetime` entitlement active. (The app links RevenueCat's identity to your `memberName` automatically on login.)

If the paywall shows "Purchases aren't available yet" instead of the price, `VITE_REVENUECAT_API_KEY_IOS` is empty or the build wasn't rebuilt after setting it — repeat steps 1–2.

---

## Part 4 — Submitting to App Review

- Make sure the in-app purchase (Part 1.2) is attached to the app version you submit — App Store Connect will prompt you to include it when you create a new version if it's not live yet.
- Apple's reviewers will test the purchase using their own sandbox account, so the sandbox flow in Part 3 needs to work cleanly.
- Guideline 3.1.1 requires all real in-app purchases to go through Apple's system — RevenueCat only wraps StoreKit, so this is already satisfied.
- Nothing else in the app needs to change for review: the paywall already discloses the price and that it's a one-time (non-renewing) purchase, and Restore Purchases is present.

## Not needed for this launch (optional later)

- **Android**: only the iOS key is wired up (`VITE_REVENUECAT_API_KEY_IOS`). Adding Android later means creating the same non-consumable product in Google Play Console, connecting a Play service-account key in RevenueCat, adding `VITE_REVENUECAT_API_KEY_ANDROID` here, and a small change to the platform check in [src/lib/purchases.ts](src/lib/purchases.ts) (`initPurchases`).
- **Backend involvement**: entitlement is checked entirely on-device via the RevenueCat SDK, matching how the rest of the games feature works (bundled at build time, no game server). No backend changes were made or are needed. If you ever want server-side visibility into who's purchased (e.g. an admin view), that would mean adding a RevenueCat webhook endpoint to the backend later — skipped for now since nothing needs it.
