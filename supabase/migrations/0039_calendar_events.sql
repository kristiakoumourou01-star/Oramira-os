-- Oramira OS — Migration 0039: first-class calendar_events
-- The planner's own event store, so priority/color/relations/recurrence are real
-- columns (no more folding into description text). Tasks/viewings/follow-ups
-- still surface in the planner as derived events; planner-created events live here.

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  type text not null default 'meeting',          -- meeting | viewing | followup | task | reminder
  start_at timestamptz not null,
  duration_min integer default 45,
  priority text default 'normal',                 -- low | normal | high | critical
  color text,
  related_lead_id uuid references leads(id) on delete set null,
  related_property_id uuid references projects(id) on delete set null,
  related_client_id uuid references contacts(id) on delete set null,
  recurring_rule text,                            -- RRULE (nullable; future recurrence)
  reminder_minutes integer,
  status text default 'scheduled',                -- scheduled | completed | cancelled
  location text,
  notes text,
  meeting_link text,
  google_event_id text,
  calendar_synced_at timestamptz,
  created_at timestamptz default now()
);
create index idx_calendar_events_owner on calendar_events (profile_id, start_at);
create index idx_calendar_events_lead on calendar_events (related_lead_id);
alter table calendar_events enable row level security;

-- Owner manages their own events; staff can read across the team (team planning).
create policy calendar_events_owner_all on calendar_events for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy calendar_events_staff_read on calendar_events for select using (is_staff());
