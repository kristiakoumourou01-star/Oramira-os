-- Oramira OS — Migration 0048: calendar_events repair (idempotent)
--
-- Fixes the runtime error "Could not find the table 'public.calendar_events' in
-- the schema cache", which occurs when migrations 0039–0043 were never applied
-- to the live database (or applied only partially). This migration is fully
-- idempotent: run it on any DB state — missing table, partial table, or fully
-- migrated — and it converges to the correct schema, indexes and RLS policies.
--
-- To apply:  supabase db push   (or paste into the Supabase SQL editor)

-- ── Table (create if the migration never ran) ──
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  type text not null default 'meeting',
  start_at timestamptz not null,
  created_at timestamptz default now()
);

-- ── Columns (cover partially-migrated states — every column from 0039–0043) ──
alter table calendar_events add column if not exists duration_min integer default 45;
alter table calendar_events add column if not exists priority text default 'normal';
alter table calendar_events add column if not exists color text;
alter table calendar_events add column if not exists related_lead_id uuid references leads(id) on delete set null;
alter table calendar_events add column if not exists related_property_id uuid references projects(id) on delete set null;
alter table calendar_events add column if not exists related_client_id uuid references contacts(id) on delete set null;
alter table calendar_events add column if not exists recurring_rule text;
alter table calendar_events add column if not exists reminder_minutes integer;
alter table calendar_events add column if not exists status text default 'scheduled';
alter table calendar_events add column if not exists location text;
alter table calendar_events add column if not exists notes text;
alter table calendar_events add column if not exists meeting_link text;
alter table calendar_events add column if not exists google_event_id text;
alter table calendar_events add column if not exists calendar_synced_at timestamptz;
alter table calendar_events add column if not exists attendees jsonb default '[]'::jsonb;
alter table calendar_events add column if not exists parent_event_id uuid references calendar_events(id) on delete cascade;
alter table calendar_events add column if not exists source text;
alter table calendar_events add column if not exists source_key text;
alter table calendar_events add column if not exists recurs_until timestamptz;
alter table calendar_events add column if not exists excluded_dates jsonb default '[]'::jsonb;
alter table calendar_events add column if not exists reminder_sent_at timestamptz;

-- ── Indexes ──
create index if not exists idx_calendar_events_owner on calendar_events (profile_id, start_at);
create index if not exists idx_calendar_events_lead on calendar_events (related_lead_id);
create index if not exists idx_calendar_events_parent on calendar_events (parent_event_id);
create unique index if not exists idx_calendar_events_source_key on calendar_events (source_key) where source_key is not null;

-- ── RLS (owner manages own events; staff can read the team's for planning) ──
alter table calendar_events enable row level security;
drop policy if exists calendar_events_owner_all on calendar_events;
create policy calendar_events_owner_all on calendar_events for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists calendar_events_staff_read on calendar_events;
create policy calendar_events_staff_read on calendar_events for select using (is_staff());

-- ── Force PostgREST to reload its schema cache (clears the "schema cache" error
--    even when the table already existed but the API hadn't picked it up). ──
notify pgrst, 'reload schema';
