-- Student-living improvement features.
-- Pinned announcements (#7), away-until ranges (#8), chore photo proof (#12),
-- communal staples (#5) and recurring shared bills (#4).

-- #7 Pinned announcement: one message can be pinned per collective.
ALTER TABLE chat_messages ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- #8 Away mode date range: when set, the member auto-resumes to ACTIVE after this date.
ALTER TABLE members ADD COLUMN away_until DATE;

-- #12 Chore photo proof: optional image attached when a task is completed.
ALTER TABLE tasks ADD COLUMN completion_image_data TEXT;
ALTER TABLE tasks ADD COLUMN completion_image_mime VARCHAR(120);

-- #5 Communal staples: a shopping item flagged as a recurring house staple.
ALTER TABLE shopping_items ADD COLUMN staple BOOLEAN NOT NULL DEFAULT FALSE;

-- #4 Recurring shared bills: an expense template that regenerates monthly.
ALTER TABLE expenses ADD COLUMN recurring BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN recurrence_day_of_month INTEGER;
