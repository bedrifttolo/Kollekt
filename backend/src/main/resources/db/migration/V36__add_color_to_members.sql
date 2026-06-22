-- Per-member avatar color chosen in the profile (null = use the app's default derived color)
ALTER TABLE members ADD COLUMN color VARCHAR(16);
