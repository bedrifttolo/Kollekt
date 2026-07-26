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

-- `flyway_schema_history` is deliberately NOT touched anywhere in this file.
-- Flyway keeps `select * from flyway_schema_history for update` open on a second
-- connection for the whole migration run. Anything needing a conflicting lock on
-- that table blocks until the statement timeout aborts the migration, so it must
-- be handled out-of-band (see KOLLEKT_OVERVIEW.md).

-- Defence in depth: strip the grants Supabase hands the PostgREST roles, so these
-- tables stay unreachable even if RLS is ever switched off. The roles only exist on
-- Supabase, hence the lookup. RLS above is the actual protection — this block is
-- hardening, so a short lock_timeout plus per-statement error handling makes sure it
-- can never take the deploy down.
do $$
declare
    tbl      record;
    grantees text;
begin
    select string_agg(quote_ident(rolname), ', ')
      into grantees
      from pg_roles
     where rolname in ('anon', 'authenticated');

    if grantees is null then
        return; -- plain local Postgres: no PostgREST roles to revoke from
    end if;

    -- Surface a blocked table as a catchable lock_not_available instead of burning
    -- the statement timeout. Scoped to this migration's transaction.
    set local lock_timeout = '3s';

    for tbl in
        select tablename
          from pg_tables
         where schemaname = 'public'
           and tablename <> 'flyway_schema_history'
    loop
        begin
            execute format('revoke all on public.%I from %s', tbl.tablename, grantees);
        exception when lock_not_available then
            raise notice 'revoke skipped, % is locked', tbl.tablename;
        end;
    end loop;

    begin
        execute format('revoke all on all sequences in schema public from %s', grantees);
    exception when lock_not_available then
        raise notice 'sequence revoke skipped, object locked';
    end;

    -- Future migrations must not re-expose their tables.
    execute format(
        'alter default privileges for role %I in schema public revoke all on tables from %s',
        current_user, grantees
    );
    execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from %s',
        current_user, grantees
    );
end
$$;
