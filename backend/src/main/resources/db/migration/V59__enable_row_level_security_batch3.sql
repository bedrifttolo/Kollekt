-- Lock down remaining tables against Supabase's PostgREST API (batch 3 of 3).
alter table party_game_participants enable row level security;
alter table party_game_questions enable row level security;
alter table friendships enable row level security;
alter table house_checkins enable row level security;
alter table task_swap_requests enable row level security;
alter table checkin_responses enable row level security;
alter table custom_achievements enable row level security;
alter table house_rule_ack enable row level security;
alter table collective_quiet_hours enable row level security;
alter table maintenance_ticket_status_history enable row level security;
alter table task_history enable row level security;
alter table kudos enable row level security;
alter table event_attendance enable row level security;

-- NOTE: `flyway_schema_history` is deliberately absent and cannot be added here.
-- Flyway holds `select * from flyway_schema_history for update` on a separate
-- connection for the whole migration run; `alter table` needs ACCESS EXCLUSIVE,
-- which conflicts with that row lock, so the statement blocks until it hits the
-- statement timeout and the migration fails. Enable RLS on it out-of-band instead:
--     alter table public.flyway_schema_history enable row level security;
-- run once from the Supabase SQL editor. The revoke below already removes all
-- PostgREST access to it in the meantime.
alter table flyway_schema_history enable row level security;

-- Defence in depth: revoke PostgREST role grants (only exist on Supabase).
-- If these roles exist, strip all table/sequence access so API exposure is blocked
-- even if RLS is accidentally disabled. These roles don't exist on plain Postgres.
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on all tables in schema public from anon;
        revoke all on all sequences in schema public from anon;
        -- Future migrations must not re-expose tables.
        execute format('alter default privileges for role %I in schema public revoke all on tables from anon', current_user);
        execute format('alter default privileges for role %I in schema public revoke all on sequences from anon', current_user);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
        revoke all on all tables in schema public from authenticated;
        revoke all on all sequences in schema public from authenticated;
        -- Future migrations must not re-expose tables.
        execute format('alter default privileges for role %I in schema public revoke all on tables from authenticated', current_user);
        execute format('alter default privileges for role %I in schema public revoke all on sequences from authenticated', current_user);
    end if;
end
$$;
