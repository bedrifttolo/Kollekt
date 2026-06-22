# Plan — Real peer-to-peer payments on the Economy page

## Objective
Let housemates actually pay each other the money they owe (from split expenses)
through their real payment apps — **Vipps, MobilePay, PayPal.me, and bank
transfer (IBAN/account number)**. Members register their own payment handles
once; when settling a debt, Kollekt deep-links into the recipient's chosen app
with the amount and recipient pre-filled, then marks the debt settled.

## Compliance & security model (why this design)
Apple (App Store Review 3.1.5(a) / Apple Pay PassKit) and Google do **not**
allow a non-licensed app to move money between two private people in-app. Apple
Pay is for buying goods/services from a registered merchant, not arbitrary P2P
transfer. Becoming a money transmitter needs PSP licensing + KYC/AML.

**Therefore Kollekt never touches money.** It is a directory of payment handles +
a deep-link launcher. This is exactly how Splitwise / Settle Up / Tricount
operate and is store-compliant:
- No card data, no PCI scope, no Apple IAP cut (real-world money service).
- Handles (Vipps phone, IBAN, MobilePay phone, PayPal.me) are payment *receiving*
  details — meant to be shared with the people paying you, so plain DB columns
  (encrypted at rest by the DB) are appropriate; no secret-grade storage needed.

Security rules enforced:
1. Only the authenticated member can read/write **their own** handles
   (`requireTokenSubject`).
2. A member's handles are only exposed to others **in the same collective**
   (reusing existing collective-scoped access checks).
3. All handle inputs are validated/normalised server-side (length + format
   regex) to prevent deep-link/URL injection; the client URL-encodes every
   value when building links.
4. Settlement still goes through the existing `settle-with` flow — money
   movement is confirmed by the user out-of-band, then recorded.

## Exact changes

### Backend (Kotlin / Spring Boot)
1. **Migration** `backend/src/main/resources/db/migration/V41__add_payment_handles_to_members.sql`
   — add nullable columns `vipps_handle`, `mobilepay_handle`, `paypal_handle`,
   `bank_account` to `members` (mirrors existing `color`/`address` column style).
2. **`domain/Member.kt`** — add the 4 nullable fields.
3. **`api/dto/ApiModels.kt`**
   - `PaymentHandlesDto(vipps, mobilepay, paypal, bankAccount)` (all nullable).
   - `UpdatePaymentHandlesRequest(memberName, vipps, mobilepay, paypal, bankAccount)`.
   - Extend `PayOptionDto` with `handles: PaymentHandlesDto` so the client can
     build deep-links for the chosen creditor.
4. **`service/MemberOperations.kt`** — `getPaymentHandles(memberName)` and
   `updatePaymentHandles(...)` with per-provider validation (Norwegian 8-digit
   phone for Vipps/MobilePay, alphanumeric handle for PayPal, IBAN/account
   format for bank). Blank → cleared (null).
5. **`api/MemberController.kt`** — `GET /members/payment-handles` and
   `PATCH /members/payment-handles` (both `requireTokenSubject`).
6. **`service/EconomyOperations.kt::getPayOptions`** — include each creditor's
   `PaymentHandlesDto` in the returned `PayOptionDto`.

### Frontend (React / TS)
7. **`lib/types.ts`** — `PaymentHandles` interface; extend `PayOption` with
   `handles: PaymentHandles`.
8. **`lib/paymentLinks.ts`** (new, pure functions) — build deep-link URL per
   provider (`vipps://`, `mobilepay://`, `https://paypal.me/...`), with amount +
   recipient encoded; bank/IBAN returns copyable details (no scheme). Lists the
   methods a given `PaymentHandles` actually supports.
9. **`pages/EconomyPage.tsx`** — replace the single "Pay" button behaviour with a
   pay sheet: show the selected creditor's available methods → tapping one opens
   the deep-link (Capacitor `Browser`/`window.location`) → "I've paid — mark
   settled" calls the existing `settle-with`. Minimal, contained to the existing
   pay-card block; unchanged when a creditor has no handles (falls back to
   today's plain settle button).
10. **`pages/ProfilePage.tsx`** — new collapsible "Payment methods" section
    (mirrors the existing invite/password collapsible pattern) where the member
    registers/edits their own 4 handles.
11. **`i18n/locales/en.json` & `no.json`** — add `economy.pay.*` and
    `profile.paymentMethods.*` strings (Norwegian primary audience).

## Out of scope (explicitly not doing)
- No in-app money processing / Apple Pay PassKit / card handling.
- No new payment-provider SDKs or server-side PSP integration.
- No refactor of the existing expense/balance/settlement logic — `settle-with`
  is reused as-is.

## Verification
- `cd backend && ./gradlew test` (economy + member tests stay green; migration
  applies).
- `npm run typecheck` for the frontend.
- Manual: register handles in Profile → owe a housemate → Pay → deep-link opens
  → mark settled → balance clears.
