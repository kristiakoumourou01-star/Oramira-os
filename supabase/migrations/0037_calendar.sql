-- Oramira OS — Migration 0037: Calendar + Google sync
-- Per-user Google Calendar connection (OAuth tokens) and meeting/Meet links on
-- the things that become calendar events (tasks, follow-ups, viewings).

create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  provider text not null default 'google',
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  calendar_id text default 'primary',
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (profile_id, provider)
);
alter table calendar_connections enable row level security;
-- Owner can see whether they're connected; tokens are only ever used server-side.
create policy calendar_self on calendar_connections for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Meeting / Google Meet join links on calendar-able records.
alter table tasks add column meeting_link text;
alter table follow_up_tasks add column meeting_link text;
alter table viewings add column meeting_link text;
