-- Oramira OS — Migration 0040: event attendees
-- Structured attendees on calendar events: [{ email, name, avatar_url }].
alter table calendar_events add column attendees jsonb default '[]'::jsonb;
