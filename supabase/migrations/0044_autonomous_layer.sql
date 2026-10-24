-- Oramira OS — Migration 0044: Autonomous Layer
-- Idempotency key so the orchestration + self-healing engines can auto-create
-- tasks exactly once, and a store for the learning loop's periodic insights.

-- Auto-created tasks carry a stable source_key; a partial unique index makes
-- re-runs no-ops without constraining human-created tasks (which stay null).
alter table tasks add column if not exists source_key text;
create unique index if not exists tasks_source_key_uniq on tasks (source_key) where source_key is not null;

-- Learning loop — one row per insight kind, refreshed by the daily job. Staff
-- read-only; only trusted server code (service role) writes.
create table if not exists learning_insights (
  id uuid primary key default gen_random_uuid(),
  kind text not null unique,           -- source_conversion | response_time | cadence | negotiation
  payload jsonb not null default '{}',
  sample_size integer not null default 0,
  computed_at timestamptz not null default now()
);
alter table learning_insights enable row level security;
create policy learning_insights_staff_read on learning_insights for select using (is_staff());
