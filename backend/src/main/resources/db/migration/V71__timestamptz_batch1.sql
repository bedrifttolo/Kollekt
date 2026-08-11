-- Part of the timezone-naive timestamp fix (see V70): these columns are all "moment something
-- happened" timestamps that were stored as naive `timestamp`/`timestamp(6)` with no offset,
-- causing clients outside the server's zone (UTC) to display the wrong clock time. Existing
-- values are reinterpreted as UTC wall-clock time (not shifted), matching how the server has
-- always written them via `LocalDateTime.now()` on a UTC JVM. Split into batches (mirroring the
-- V57-V59 RLS rollout precedent) since each ALTER COLUMN forces a full table rewrite and a single
-- migration touching every table risks timing out on Supabase's free tier.
alter table invitations
    alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table invitations
    alter column accepted_at type timestamptz using accepted_at at time zone 'UTC';

alter table settlement_checkpoints
    alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table tasks
    alter column completed_at type timestamptz using completed_at at time zone 'UTC';

alter table task_feedback
    alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table shopping_items
    alter column completed_at type timestamptz using completed_at at time zone 'UTC';

alter table personal_settlements
    alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table party_game_rooms
    alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table party_game_participants
    alter column joined_at type timestamptz using joined_at at time zone 'UTC';
alter table party_game_questions
    alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table custom_achievements
    alter column created_at type timestamptz using created_at at time zone 'UTC';
