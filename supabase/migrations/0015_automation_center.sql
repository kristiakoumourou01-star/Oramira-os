-- Oramira OS — Migration 0015: Automation Center
-- The central automation engine's audit trail. Additive (don't edit 0001–0014).
-- The automation logic lives in application code (lib/automations.ts) invoked
-- by cron (Vercel Cron and/or a Supabase scheduled Edge Function hitting
-- /api/cron) so it can reuse every existing helper, notification path, and the
-- find_or_create_contact identity chokepoint. Each run is recorded here for
-- success/failure tracking and audit history.

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,                       -- e.g. 'reservation_expiry'
  status text not null default 'success',  -- success | failed | partial
  processed int default 0,                 -- items acted on / notified
  summary text,
  details jsonb default '{}',
  error text,
  triggered_by text default 'cron',        -- cron | manual | event
  started_at timestamptz default now(),
  finished_at timestamptz
);
create index idx_automation_runs_job on automation_runs (job, started_at desc);

alter table automation_runs enable row level security;

-- Staff read the log; writes come from the service-role client (cron/manual
-- runs), which bypasses RLS. Manual "run now" by staff also writes via the
-- service-role helper, so this policy is effectively read-for-staff.
create policy automation_runs_staff_all on automation_runs for all using (is_staff()) with check (is_staff());

-- NOTE on scheduling: pg_cron is intentionally NOT configured here (it isn't
-- enabled on every Supabase plan and would fail db push where absent). Schedule
-- via Vercel Cron (vercel.json) or a Supabase scheduled Edge Function — both
-- call POST /api/cron with the CRON_SECRET. See supabase/functions/automations.
