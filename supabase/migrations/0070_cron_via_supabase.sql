-- 0070 · Αυτόματες εργασίες από το Supabase (pg_cron) αντί για Vercel Cron.
-- Το δωρεάν Vercel (Hobby) επιτρέπει cron μόνο μία φορά τη μέρα. Εδώ η βάση
-- καλεί το /api/cron?job=… της εφαρμογής στα ίδια ωράρια (UTC) με Bearer
-- κλειδί από το Supabase Vault (όνομα 'cron_secret'). Το ίδιο κλειδί μπαίνει
-- στο Vercel ως CRON_SECRET. Αν αργότερα περάσετε σε Vercel Pro, δεν χρειάζεται
-- αλλαγή — ή σβήνετε τα jobs με: select cron.unschedule(jobname) from cron.job where jobname like 'oramira:%';

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.app_cron_config (
  id int primary key default 1 check (id = 1),
  app_url text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.app_cron_config enable row level security;
drop policy if exists app_cron_config_admin on public.app_cron_config;
create policy app_cron_config_admin on public.app_cron_config for select using (current_app_role()::text = 'admin');
insert into public.app_cron_config (id, app_url) values (1, 'https://app.oramiraltd.com')
on conflict (id) do nothing;

-- Καλεί μία εργασία της εφαρμογής. Χωρίς κλειδί στο Vault δεν καλεί τίποτα.
create or replace function public.call_app_cron(p_job text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text; v_on boolean; v_secret text;
begin
  if p_job !~ '^[a-z_]{2,40}$' then raise exception 'bad job'; end if;
  select app_url, enabled into v_url, v_on from app_cron_config where id = 1;
  if v_url is null or not v_on then return null; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_secret is null then return null; end if;
  return net.http_get(
    url := rtrim(v_url, '/') || '/api/cron?job=' || p_job,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
end $$;
revoke all on function public.call_app_cron(text) from public, anon, authenticated;

-- Τα ωράρια (ίδια με το παλιό vercel.json, UTC).
do $$
declare r record;
begin
  for r in select * from (values
    ('reservation_expiry', '0 * * * *'),
    ('website_sync', '*/15 * * * *'),
    ('maintenance', '0 */6 * * *'),
    ('warranty_expiry', '0 8 * * *'),
    ('payment_reminders', '0 9 * * *'),
    ('crm', '0 7 * * *'),
    ('speed_to_lead', '*/5 * * * *'),
    ('sales_cadence', '15 * * * *'),
    ('lead_digest', '0 * * * *'),
    ('contract_reminders', '0 6 * * *'),
    ('viewing_reminders', '0 * * * *'),
    ('meeting_reminders', '30 * * * *'),
    ('dead_lead_reactivation', '0 10 * * *'),
    ('auto_calendar_events', '0 5 * * *'),
    ('churn_detection', '0 6 * * *'),
    ('owner_lifecycle', '0 7 * * *'),
    ('task_orchestration', '0 */2 * * *'),
    ('self_healing', '0 8 * * *'),
    ('learning_loop', '0 4 * * *'),
    ('executive_memory', '0 3 * * *'),
    ('acquisition_cadence', '0 9 * * *'),
    ('acquisition_ops', '0 8 * * *'),
    ('gdpr_retention', '30 2 * * *')
  ) as t(job, schedule) loop
    perform cron.schedule('oramira:' || r.job, r.schedule, format('select public.call_app_cron(%L)', r.job));
  end loop;
end $$;
