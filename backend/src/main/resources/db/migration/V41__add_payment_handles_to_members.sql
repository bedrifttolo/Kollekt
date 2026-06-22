-- Payment receiving handles a member registers so housemates can pay them
-- directly through their own payment app (Vipps / MobilePay / PayPal) or by
-- bank transfer. Kollekt only stores and deep-links to these; it never moves money.
ALTER TABLE members ADD COLUMN vipps_handle VARCHAR(32);
ALTER TABLE members ADD COLUMN mobilepay_handle VARCHAR(32);
ALTER TABLE members ADD COLUMN paypal_handle VARCHAR(64);
ALTER TABLE members ADD COLUMN bank_account VARCHAR(64);
