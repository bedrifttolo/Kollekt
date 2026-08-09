# Android release setup guide

Everything code-side for Android parity is done: the manifest, signing config, FCM push
gateway, RevenueCat platform check, and AdMob native config are all wired up and verified
to build/sign successfully. What's left can only be done by you, in the Firebase, Google
Play Console, and RevenueCat dashboards, because each requires your own account
credentials. Follow this in order — each part depends on the one before it.

Key identifiers used in the code (must match exactly what you create below):

| What | Value |
|---|---|
| Application ID | `no.kollekt.app` |
| Upload keystore | `android/app/kollekt-upload-key.jks` (gitignored) |
| Upload key alias | `kollekt-upload` |
| RevenueCat non-consumable product ID | `kollekt_lifetime_unlock` (same as iOS) |
| RevenueCat Entitlement ID | `premium_lifetime` (same as iOS) |

---

## Part 1 — Release signing (already done)

A real upload keystore has already been generated for this repo:

- **Keystore file:** `android/app/kollekt-upload-key.jks` — gitignored, exists only on this machine.
- **`android/key.properties`** (gitignored) points Gradle at it.
- **Store/key password and SHA-256 fingerprint** were shown once at generation time — make sure you saved them to a password manager. If you didn't, there is no way to recover the password from the keystore file itself.

**Back this up now if you haven't**: copy `android/app/kollekt-upload-key.jks` and `android/key.properties` somewhere durable outside this working copy (a password manager's file-attachment feature works well). There is no CI-held backup copy. If this file is lost *and* you never enrolled in Play App Signing (Part 4 covers this — enrollment happens automatically on first upload), Google cannot help you recover it, and you'd be unable to publish updates to the existing app listing. If you did enroll in Play App Signing and lose only the *upload* key, Play Console's **App integrity → App signing → Request upload key reset** flow lets you register a new upload key without losing the app.

To re-derive the fingerprint later (e.g. for Play Console verification or Firebase's SHA-1 field for Google Sign-In):
```bash
keytool -list -v -keystore android/app/kollekt-upload-key.jks -alias kollekt-upload
```
(enter the store password when prompted).

Every Play Console upload needs `android/app/build.gradle`'s `versionCode` incremented by exactly 1 from the previous upload; bump `versionName` in lockstep with iOS's `MARKETING_VERSION` (`ios/App/App.xcodeproj/project.pbxproj`) so both platforms show the same product version to users.

---

## Part 2 — Firebase project (for Android push notifications)

Android push delivery (`FirebaseFcmGateway`/`FcmPushService` in the backend) is fully implemented but stays a safe no-op until you complete this.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (or reuse an existing one if you already have a Google Cloud project for Kollekt).
2. Inside the project, **Add app → Android**. Package name: `no.kollekt.app`. Add the SHA-256 fingerprint from Part 1 if prompted (needed later for Google Sign-In, harmless to add now).
3. Download the generated `google-services.json` and place it at `android/app/google-services.json`. It's gitignored (see `android/app/build.gradle`'s `.gitignore` entry) and the existing defensive Gradle block already only applies the `com.google.gms.google-services` plugin when this file exists — no code change needed, this is a drop-in step.
4. **Project settings → Service accounts → Generate new private key** — downloads a service-account JSON. This is what the *backend* uses to send messages (distinct from the app-side `google-services.json`).
5. Base64-encode it and set it as the backend's `FCM_CREDENTIALS_BASE64` environment variable (see `.env.example`/`.env` locally, or your deploy platform's env var / secrets UI in production):
   ```bash
   base64 -i service-account.json | tr -d '\n'
   ```
6. Restart/redeploy the backend. On startup you should see an INFO log line confirming FCM is configured (absence of "FCM not configured..." means it picked up the credentials); on failure it logs a WARN and safely no-ops rather than crashing.
7. Rebuild the Android app (`npm run mobile:sync` then a fresh `assembleRelease`/`bundleRelease`) so the new `google-services.json` and the Google Services Gradle plugin are picked up.

---

## Part 3 — AdMob (only if/when you enable ads)

`android/variables.gradle` currently ships Google's **public test** AdMob Android App ID (`ca-app-pub-3940256099942544~3347511713`) so the manifest entry is always valid and the SDK never crashes on init, even with ads disabled (`VITE_ENABLE_ADS=false`). Before setting `VITE_ENABLE_ADS=true` for a real release:

1. [admob.google.com](https://admob.google.com) → add an Android app for `no.kollekt.app` (or link the existing AdMob account used for iOS) → copy its real **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` format).
2. Replace the placeholder value of `admobAndroidAppId` in `android/variables.gradle` with the real ID.
3. Set `VITE_ADMOB_HOME_BANNER_ANDROID` in `.env.mobile` to the real ad unit ID (mirrors `VITE_ADMOB_HOME_BANNER_IOS`).

---

## Part 4 — Google Play Console app + listing

1. [play.google.com/console](https://play.google.com/console) → **Create app**. Name: Kollekt. Default language, free app, confirm declarations.
2. **App content** section — fill in every required declaration before you can release even to a closed track:
   - **Privacy policy** URL (reuse whatever `VITE_PRIVACY_URL` points at — same as iOS).
   - **Data safety** — this needs your own accounting of what the app actually collects/shares; the code review that produced this doc surfaced these data touchpoints, but the Play Console form submission is yours to finalize:
     - Camera photos (chat images, `android.permission.CAMERA`)
     - Calendar read/write (`READ_CALENDAR`/`WRITE_CALENDAR`, for the shared calendar + optional Google Calendar sync)
     - Push notification tokens (`push_device_tokens` table — device identifiers, used only for delivering this app's own notifications, not shared with third parties beyond Apple/Google's push infrastructure)
     - Account info (email, member name) and in-app content (chat messages, tasks, expenses) — all scoped to the user's own household
     - Payment handle links (Vipps/MobilePay usernames the user chooses to add — no payment processing happens in-app)
   - **Ads** declaration — mark as containing ads only once `VITE_ENABLE_ADS=true` is actually shipped (Part 3).
   - **Target audience** / **Content rating** questionnaire.
3. **Store listing** — icon, screenshots (portrait phone at minimum), short/full description, matching what's already written for the iOS App Store listing where applicable.

---

## Part 5 — Play App Signing enrollment

Play App Signing is Google's recommended model: you sign uploads with your **upload key** (Part 1's keystore), Google re-signs the distributed APK with an **app signing key** it holds. This is what lets Play Console's "Request upload key reset" recover you from a lost upload key.

1. On your **first** release (any track, including internal testing), Play Console will detect the app isn't yet enrolled and prompt you to opt in to Play App Signing during the upload flow. Accept it.
2. Play Console will show the certificate fingerprint it extracted from your uploaded AAB/APK — confirm it matches the SHA-256 from Part 1's `keytool -list -v` output.
3. From this point on, every future upload must be signed with the same upload key (`android/key.properties` + `kollekt-upload-key.jks`) — Google handles the re-signing with the app signing key automatically.

---

## Part 6 — RevenueCat Android product setup

Mirrors [release/REVENUECAT_SETUP.md](REVENUECAT_SETUP.md) Part 1–2, for Android. `src/lib/purchases.ts` already reads `VITE_REVENUECAT_API_KEY_ANDROID` and picks it automatically on Android — no code change needed once you complete this.

1. **Play Console → Monetize → Products → In-app products → Create product.**
   - **Product ID**: exactly `kollekt_lifetime_unlock` (must match iOS's product ID so RevenueCat can attach both to the same `premium_lifetime` entitlement).
   - **Non-consumable**, priced to match the iOS 29 kr price point for the Norway storefront.
2. **Play Console → Setup → API access** → link (or create) a Google Cloud project, then **Create new service account** with the **Financial data, orders, and cancellation survey responses** permission (Play Console will guide you through the exact role). Grant it access.
3. **RevenueCat dashboard → Project settings → Apps → + New → Google Play Store app.** Package name `no.kollekt.app`. Upload the service-account JSON from step 2 (RevenueCat needs this to verify purchases server-side, same role as the App Store shared secret/key does for iOS).
4. **RevenueCat → Products** → add the `kollekt_lifetime_unlock` Play Store product, attach it to the existing `premium_lifetime` entitlement (the same entitlement iOS already uses — do not create a second one).
5. **RevenueCat → API keys** → copy the Google Play Store public SDK key (`goog_...` prefix) into `VITE_REVENUECAT_API_KEY_ANDROID` in `.env.mobile`.
6. Rebuild (`npm run mobile:sync`), install on a device signed into a **Play Console license tester** account (Play Console → Setup → License testing), and confirm the paywall shows the real price and completes a test purchase without a charge.

---

## Part 7 — Closed testing track + first release

1. **Play Console → Testing → Closed testing** → create a track (e.g. "Alpha"), add tester email addresses or a Google Group.
2. Build a signed release bundle: `npm run mobile:sync` then `cd android && ./gradlew bundleRelease` (produces `android/app/build/outputs/bundle/release/app-release.aab`). Use `bundleRelease`, not `assembleRelease` — Play Console requires an AAB, not an APK, for new apps.
3. Upload the AAB to the closed testing track, fill in release notes, roll out.
4. Wait for Play Console's automated **pre-launch report** (crawls the app on real/virtual devices) — check it for crashes before inviting testers.
5. Once testers confirm it works, promote through Play Console's tracks (closed → open/production) at your own pace — same review process either way, typically same-day to a few days for a new app's first review.
