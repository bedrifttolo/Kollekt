-- The icon a member picks when they create a custom house achievement, so their goal shows a
-- fitting symbol instead of the generic default. Existing rows keep the previous default icon.
ALTER TABLE custom_achievements ADD COLUMN icon VARCHAR(32) NOT NULL DEFAULT 'sparkles';
