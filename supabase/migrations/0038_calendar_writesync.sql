-- Oramira OS — Migration 0038: Google Calendar write-sync
-- Track the Google event mirror for each calendar-able record so we can update
-- (and avoid duplicating) the event on change.

alter table tasks add column google_event_id text;
alter table tasks add column calendar_synced_at timestamptz;

alter table follow_up_tasks add column google_event_id text;
alter table follow_up_tasks add column calendar_synced_at timestamptz;

alter table viewings add column google_event_id text;
alter table viewings add column calendar_synced_at timestamptz;
