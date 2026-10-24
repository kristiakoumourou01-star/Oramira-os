-- Oramira OS — Migration 0041: recurring + system-generated events
-- recurring_rule already exists (0039). Add parent_event_id so a single
-- occurrence can be detached from its series ("edit this event"), and
-- source/source_key so the automation engine can create (and de-duplicate)
-- system events like contract expiries and viewing reminders.
alter table calendar_events add column parent_event_id uuid references calendar_events(id) on delete cascade;
alter table calendar_events add column source text;      -- manual | contract_expiry | contract_renewal | warranty_expiry | viewing_reminder | payroll_deadline
alter table calendar_events add column source_key text;  -- idempotency key for system events

create index idx_calendar_events_parent on calendar_events (parent_event_id);
create unique index idx_calendar_events_source_key on calendar_events (source_key) where source_key is not null;
