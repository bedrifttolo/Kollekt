-- Lock down critical tables against Supabase's PostgREST API (batch 1 of 3).
-- Enabling RLS on all 37 tables in one migration times out on Supabase's free tier.
-- Split into 3 migrations (V57, V58, V59) so each completes within statement timeout.
--
-- Kollekt never talks to Supabase directly: the React client only calls the Kotlin
-- backend, which connects over JDBC as the role that owns these tables. Supabase
-- nevertheless exposes every table in `public` through PostgREST, so without RLS
-- anyone holding the project's anon key could read/write the whole database.
--
-- Fix: enable RLS on every table and define no policies. "RLS on, zero policies"
-- denies all access to ordinary roles such as `anon` and `authenticated`, while the
-- table owner (our JDBC role) still bypasses RLS — authorization stays in the API layer.

-- Batch 1: tables with sensitive data or high transaction volume (time-critical).
alter table members enable row level security;
alter table auth_tokens enable row level security;
alter table push_device_tokens enable row level security;
alter table chat_messages enable row level security;
alter table expenses enable row level security;
alter table personal_settlements enable row level security;
alter table tasks enable row level security;
alter table social_identities enable row level security;
alter table party_game_rooms enable row level security;
alter table house_rules enable row level security;
alter table guest_notices enable row level security;
alter table maintenance_ticket enable row level security;
