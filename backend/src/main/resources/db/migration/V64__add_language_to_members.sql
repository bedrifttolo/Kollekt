-- The member's chosen app language (en/no/sv/da), used to localize push notification copy.
-- The frontend's own UI language is localStorage-only; this column exists purely so the
-- backend can pick the right locale when composing a push notification.
ALTER TABLE members ADD COLUMN language VARCHAR(2);
