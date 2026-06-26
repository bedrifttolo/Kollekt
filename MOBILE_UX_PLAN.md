# Mobile UX Plan (for tomorrow)

Three workstreams: (1) get the app launching in Xcode again, (2) make Shopping List &
Maintenance as rich as the Tasks tab, (3) confirm safe-area handling on device.

---

## 1. Fix the Xcode / Simulator launch failure

**Error:** `Simulator device failed to launch no.kollekt.app — NSPOSIXErrorDomain Code 3, No such process.`

**Root cause (most likely):** the native iOS project is out of sync with the web project.
`@capacitor/camera` was added to `package.json`, but `cap sync` hasn't run yet — the synced
`ios/App/App/capacitor.config.json` `packageClassList` still has no Camera plugin. A half-synced
project (JS references a plugin the native build hasn't linked) commonly fails to launch with
"No such process."

**Steps:**
1. Quit Xcode **and** the Simulator.
2. `npm run build:mobile`
3. `npx cap sync ios`   ← resolves SPM packages (incl. camera) and regenerates the native config
4. `npx cap open ios`
5. Xcode → Product → **Clean Build Folder** (⇧⌘K). If still odd, delete DerivedData
   (`~/Library/Developer/Xcode/DerivedData`).
6. Simulator → Device → **Erase All Content and Settings** (clears the stale install), or pick a
   different simulator.
7. Xcode → target App → Signing & Capabilities → pick a valid Team if prompted.
8. Build & Run.

**If it still says "No such process":** delete the app from the simulator, reboot the simulator
(Device → Restart), confirm the scheme is `App` and the simulator's iOS ≥ the deployment target,
then retry.

**Verify after launch:** camera button in Chat and the Task-feedback photo button should now show
the native **Camera / Photo Library** prompt (the new `@capacitor/camera` wiring).

---

## 2. Shopping List & Maintenance — bring them up to the Tasks tab's level

**Goal:** the Tasks tab feels full and engaging (gradient hero card, big number, filter chips, rich
cards). Shopping List looks sparse (small header strip + plain rows, lots of empty space) and
Maintenance is plainer than Tasks. Make both spacious, user-friendly, and consistent.

**Reuse existing styles — no new abstractions:**
- `.househero` (gradient hero card) + `.bignum` (big number) — `src/styles/globals.css:180-181`
- `.seg` segmented control and the pill filter chips already used on the Tasks tab.

### 2a. Shopping List — `src/pages/TasksPage.tsx` (the `tab === 'shopping'` branch, ~1307–1430)
- **Add a hero card** (reuse `.househero`) at the top of the branch, mirroring the Tasks hero:
  eyebrow + big number of items still to buy (e.g. "4 to restock"), a subtitle ("2 bought this
  week"), and a thin `ProgressBar` (bought / total). Replace the small "Restock / Shared supplies
  tracker" glass strip with this.
- **Add filter chips** like Tasks (All / To buy / Bought). New state `shoppingFilter`, filter the
  `shopping` list before mapping. Match the chip styling already used for the maintenance filters.
- **Richer item rows:** more vertical padding, item icon, "added by + when", who bought it, optional
  quantity; keep the enlarged primary **Buy** button. Add a friendly empty state when nothing's to
  buy.
- Optional: split into "To buy" and "Recently bought" sections to fill the space.

### 2b. Maintenance — `src/pages/TasksPage.tsx` (the maintenance branch, ~1515+)
- **Upgrade the "Maintenance board" strip to a `.househero` hero:** big number of open tickets +
  an "X overdue" / "Y done" subtitle and a small progress bar (done / total). Keep the existing
  filter chips (All/Open/In progress/Blocked/Done) but align them to the Tasks chip styling.
- **More spacious ticket cards:** clearer priority pill, a status-colour accent stripe, and bigger
  touch targets for the status / assignee / priority controls (the three small `<select>`s are
  cramped — make them taller, or convert status to a segmented control). Keep the "mark Done →
  economy" flow but make it more prominent.
- Polish the empty state.

### i18n (add keys in all four: `src/i18n/locales/{en,no,sv,da}.json`)
- Shopping: hero labels (`toBuy`, `boughtThisWeek`), filter labels (`all`, `toBuy`, `bought`).
- Maintenance: hero labels (`open`, `overdue`, `done`).

**Scope:** contained to the shopping/maintenance branches of `TasksPage.tsx` + the four locale
files. Reuse `househero`/`bignum`/`seg`/chip classes — no CSS or new components needed.
**Effort:** ~half a day. Commit Shopping and Maintenance separately.

---

## 3. Safe-area (header / bottom nav) — verify, probably already correct

The latest **Tasks** screenshots show correct insets: the "Tasks" header sits below the Dynamic
Island and the bottom nav clears the home indicator. The web layer is already correct:
- `index.html` has `viewport-fit=cover`.
- `.safe-top` / `.safe-bottom` (`src/styles/globals.css:152-154`) apply `env(safe-area-inset-*)`,
  used by `AppHeader` (`safe-top`) and `BottomNav` (`safe-bottom`).
- iOS uses the default edge-to-edge `CAPBridgeViewController` (`Main.storyboard`), so `env()`
  resolves.

The earlier Chat-screen overlap was almost certainly the **stale build** (same root cause as the
Xcode failure — no `cap sync`). After step 1's rebuild, re-check every tab, especially **Chat**.
If Chat still overlaps after a clean rebuild, the only place to look is the Chat page's own thread
header sitting under a correctly-inset `AppHeader` — no code change is expected; `.app-screen`
already subtracts `4rem + env(safe-area-inset-top)`.

---

## Suggested order tomorrow
1. `npm run build:mobile && npx cap sync ios` → clean build in Xcode (unblocks testing; no commit).
2. Commit: Shopping List enhancement.
3. Commit: Maintenance enhancement.
4. Re-verify safe-area on device; commit a tweak only if Chat still overlaps.
