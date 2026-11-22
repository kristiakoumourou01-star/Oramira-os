-- Oramira OS — Migration 0109: Marketing → Δικοί μου αυτοματισμοί
-- Automations the owner builds herself: either on a time schedule (one-off /
-- daily / weekly / monthly, to an audience) or when something happens
-- (new lead, viewing, contract, payment due, birthday… → that contact).
-- The 15-minute cron job «marketing_automations» runs them.

create table if not exists marketing_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'schedule' check (kind in ('schedule', 'event')),
  channel text not null default 'email' check (channel in ('email', 'sms', 'whatsapp', 'push')),
  audience jsonb not null default '{}'::jsonb,
  trigger jsonb not null default '{}'::jsonb,
  subject text,
  body text not null default '',
  schedule jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  active_since timestamptz not null default now(),
  next_run_at timestamptz,
  last_run_at timestamptz,
  runs int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_marketing_automations_due on marketing_automations (active, next_run_at);
alter table marketing_automations enable row level security;
drop policy if exists marketing_automations_staff_all on marketing_automations;
create policy marketing_automations_staff_all on marketing_automations for all using (is_staff()) with check (is_staff());

-- One row per message an event automation sent, so a record never gets it twice.
create table if not exists marketing_automation_sends (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references marketing_automations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  record_key text not null,
  status text not null default 'pending',
  sent_at timestamptz not null default now(),
  unique (automation_id, record_key)
);
create index if not exists idx_marketing_automation_sends_auto on marketing_automation_sends (automation_id, sent_at desc);
alter table marketing_automation_sends enable row level security;
drop policy if exists marketing_automation_sends_staff_all on marketing_automation_sends;
create policy marketing_automation_sends_staff_all on marketing_automation_sends for all using (is_staff()) with check (is_staff());

select cron.unschedule('oramira:marketing_automations') where exists (select 1 from cron.job where jobname = 'oramira:marketing_automations');
select cron.schedule('oramira:marketing_automations', '*/15 * * * *', $$select public.call_app_cron('marketing_automations')$$);
