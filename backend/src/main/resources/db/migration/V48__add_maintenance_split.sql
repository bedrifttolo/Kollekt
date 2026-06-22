-- People who share the cost of a maintenance ticket (comma-separated member names).
-- When the ticket is completed, the cost becomes an economy expense split among these people.
ALTER TABLE maintenance_ticket ADD COLUMN split_participants TEXT;
