-- Freeform note a member can leave for housemates paying by card in person (e.g. "ask me
-- directly"), alongside the existing Vipps/MobilePay/PayPal/bank receiving handles. Unlike
-- those, this is display-only text, never a structured handle or real card number.
ALTER TABLE members ADD COLUMN card_info VARCHAR(256);
