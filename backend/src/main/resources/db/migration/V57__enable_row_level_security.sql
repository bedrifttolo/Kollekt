-- Lock down the public schema against Supabase's PostgREST API.
--
-- Kollekt never talks to Supabase directly: the React client only calls the Kotlin
-- backend, which connects over JDBC as the role that owns these tables. Supabase
-- nevertheless exposes every table in `public` through PostgREST, so without RLS
-- anyone holding the project's anon key could read/write the whole database
-- (members.bank_account, push_device_tokens.token, auth_tokens, chat_messages, ...).
--
-- Fix: enable RLS on every table and define no policies. "RLS on, zero policies"
-- denies all access to ordinary roles such as `anon` and `authenticated`, while the
-- table owner (our JDBC role) still bypasses RLS — we deliberately do NOT use
-- FORCE ROW LEVEL SECURITY, which would apply the policies to the owner too and
-- would break the backend. Authorization stays where it already lives: the API layer.

-- Enable RLS on every table in public (no policies = deny for anon/authenticated).
alter table flyway_schema_history enable row level security;
alter table house_rules enable row level security;
alter table achievements enable row level security;
alter table events enable row level security;
alter table invitations enable row level security;
alter table pant_entries enable row level security;
alter table settlement_checkpoints enable row level security;
alter table expense_participants enable row level security;
alter table rooms enable row level security;
alter table chat_messages enable row level security;
alter table collectives enable row level security;
alter table notifications enable row level security;
alter table shopping_items enable row level security;
alter table expenses enable row level security;
alter table task_feedback enable row level security;
alter table personal_settlements enable row level security;
alter table collective_enabled_achievements enable row level security;
alter table auth_tokens enable row level security;
alter table push_device_tokens enable row level security;
alter table social_identities enable row level security;
alter table party_game_rooms enable row level security;
alter table party_game_participants enable row level security;
alter table party_game_questions enable row level security;
alter table tasks enable row level security;
alter table friendships enable row level security;
alter table house_checkins enable row level security;
alter table task_swap_requests enable row level security;
alter table checkin_responses enable row level security;
alter table members enable row level security;
alter table custom_achievements enable row level security;
alter table house_rule_ack enable row level security;
alter table guest_notices enable row level security;
alter table collective_quiet_hours enable row level security;
alter table maintenance_ticket enable row level security;
alter table maintenance_ticket_status_history enable row level security;
alter table task_history enable row level security;
alter table kudos enable row level security;
alter table event_attendance enable row level security;

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
