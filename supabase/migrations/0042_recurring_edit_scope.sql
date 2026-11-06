-- Oramira OS — Migration 0042: recurring edit scope
-- Support "this event / this and future / entire series" edits without exploding
-- occurrences into rows: recurs_until caps a (split) series, excluded_dates lists
-- occurrence dates skipped by the expansion (detached or cancelled singles).
alter table calendar_events add column recurs_until timestamptz;
alter table calendar_events add column excluded_dates jsonb default '[]'::jsonb;
