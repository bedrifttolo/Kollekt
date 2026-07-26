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

-- 1. Enable RLS on every table we own in `public` (includes flyway_schema_history).
do $$
declare
    tbl record;
begin
    for tbl in
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and not c.relrowsecurity
          and pg_has_role(current_user, c.relowner, 'USAGE')
    loop
        execute format('alter table public.%I enable row level security', tbl.relname);
    end loop;
end
$$;

-- 2. Defence in depth: strip the blanket grants Supabase hands to the PostgREST roles,
--    so the tables are unreachable even if RLS is ever turned off again. These roles do
--    not exist on a plain local Postgres, hence the guard.
do $$
declare
    api_role text;
begin
    foreach api_role in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = api_role) then
            execute format('revoke all on all tables in schema public from %I', api_role);
            execute format('revoke all on all sequences in schema public from %I', api_role);
            -- Future tables (later Flyway migrations) must not be re-exposed either.
            execute format(
                'alter default privileges for role %I in schema public revoke all on tables from %I',
                current_user, api_role
            );
            execute format(
                'alter default privileges for role %I in schema public revoke all on sequences from %I',
                current_user, api_role
            );
        end if;
    end loop;
end
$$;
