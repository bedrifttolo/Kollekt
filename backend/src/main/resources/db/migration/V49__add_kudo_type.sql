-- Kudo category (Thank you / Cleanest / Most helpful / Peacemaker). Kept private to the recipient.
ALTER TABLE kudos ADD COLUMN type VARCHAR(32) NOT NULL DEFAULT 'THANK_YOU';
