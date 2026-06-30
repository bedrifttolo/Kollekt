# iOS Simulator Testing — Fast Path

Runbook distilled from a session that took way too long. Follow in order; don't skip the
checks — most of the pain last time came from skipping straight to "hit Run" without these.

## 0. Preflight checks (30 seconds, always do first)

```bash
df -h /                          # need at least ~10GB free in the "Avail" column
```

This Mac fills its disk easily. If free space is low, see "Disk full" below **before**
touching Xcode — a build that runs out of disk mid-compile produces a wall of misleading
cascading errors (`Operation timed out`, `Unable to resolve module dependency`, `No space
left on device`) that look like a code problem but aren't.

```bash
git config --global safe.bareRepository      # should print "all"
```

If not `all`, Swift Package Manager's cached repos fail to resolve with
`fatal: cannot use bare repository ... (safe.bareRepository is 'explicit')`. Fix once:

```bash
git config --global safe.bareRepository all
```

## 1. Build and sync

```bash
npm install                      # if @capacitor-community/admob or lucide-react ever
                                  # error as "cannot find module", a corrupt/missing
                                  # node_modules entry is the cause — npm install fixes it
npm run build:mobile
npx cap sync ios
```

## 2. One-time project config (already done, just verifying it's still there)

`ios/debug.xcconfig` must contain:
```
CAPACITOR_DEBUG = true
ADMOB_IOS_APP_ID = ca-app-pub-3940256099942544~1458002511
```
Without `ADMOB_IOS_APP_ID`, the app crashes immediately on launch — `Info.plist` sets
`GADApplicationIdentifier` to this build variable, and the AdMob SDK hard-requires a
value even when ads are disabled in JS (`VITE_ENABLE_ADS=false`). This is Google's
official test ID, fine for simulator/dev only — production needs a real one.

## 3. Open in Xcode

```bash
open ios/App/App.xcodeproj       # NOT App.xcworkspace — this project has none.
                                  # It uses local Swift Package Manager (CapApp-SPM),
                                  # not CocoaPods, so there's no workspace file.
```

## 4. Signing (one-time per machine, persists after)

1. Xcode → Settings (⌘,) → Accounts → sign in with any Apple ID (free is fine for simulator).
2. Project → App target → Signing & Capabilities → Team → select your (Personal Team).
3. **If you don't have the paid $99/year Apple Developer Program**, the "Sign in with
   Apple" capability in `ios/App/App/App.entitlements` will block signing with:
   *"Personal development teams... do not support the Sign In with Apple capability."*
   Fix for simulator testing only: remove that capability block in Signing & Capabilities
   (trash icon next to it). **Re-add it before any real device / App Store build** — it's
   a real feature of the app, just not testable without the paid account.

## 5. Run

- Destination picker (top toolbar): select **iPhone 17 Pro** (or whichever simulator).
- Press ▶ Run.
- **First build after any DerivedData wipe takes several minutes** — SPM has to
  resolve + download prebuilt binary frameworks (GoogleMobileAds, Facebook SDK,
  Alamofire, GoogleSignIn, etc.). Let it finish. Don't force-quit mid-resolution —
  doing so leaves partial downloads and the next build fails with
  `There is no XCFramework found at ...` for whichever artifacts didn't finish.
- Ignore "Communication with Apple failed" / "No profiles for ... were found" warnings
  in the Signing & Capabilities tab if your destination is a simulator — those are about
  physical-device provisioning profiles and don't block simulator builds. Just hit Run.

## Disk full — fast cleanup (safe, regenerable stuff only)

Check what's eating space:
```bash
du -sh ~/Library/Developer/Xcode/DerivedData ~/Library/Developer/CoreSimulator \
       ~/Library/Caches 2>/dev/null
```

Safe to wipe any time (fully regenerable, no data loss):
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
xcrun simctl delete unavailable
brew cleanup -s
```

Safe app caches (regenerate automatically, just re-download/recompute):
`~/Library/Caches/{com.spotify.client,vscode-cpptools,pip,Google,JetBrains,node-gyp}`,
VS Code's `CachedExtensionVSIXs` / `Cache` / `CachedData` under
`~/Library/Application Support/Code/`.

**Do NOT delete `~/Library/Caches/org.swift.swiftpm`** — that's the SPM package cache;
wiping it forces re-fetching every dependency from GitHub from scratch.

**Do NOT touch without asking first**: Docker (`~/Library/Containers/com.docker.docker`),
UTM VM images, VS Code `workspaceStorage` (has session/chat history), Claude's app data —
these can hold real, non-regenerable data.

## What's still blocking real App Store readiness (not simulator testing)

- Real `DEVELOPMENT_TEAM` — requires paid Apple Developer Program enrollment.
- Real `ADMOB_IOS_APP_ID` for Release config — get from AdMob console.
- Real Google OAuth client IDs in `.env.mobile` — Google sign-in silently no-ops without them.
- Full TestFlight/App Review testing is impossible on a free account — see
  `PUBLISH_CHECKLIST.md` for the paid-account handoff steps.
