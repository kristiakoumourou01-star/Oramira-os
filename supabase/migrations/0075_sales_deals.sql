-- Sales (όπως Pipedrive): πεδία deal στα leads, τύποι activities, και
-- changelog (ποιος άλλαξε τι και πότε) για κάθε deal.

alter table public.leads
  add column if not exists title text,
  add column if not exists value numeric,
  add column if not exists currency text not null default 'EUR',
  add column if not exists expected_close_date date,
  add column if not exists labels text[] not null default '{}',
  add column if not exists followers uuid[] not null default '{}',
  add column if not exists won_at timestamptz,
  add column if not exists lost_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists in_inbox boolean not null default false;

create index if not exists leads_expected_close_idx on public.leads (expected_close_date) where deleted_at is null;
create index if not exists leads_inbox_idx on public.leads (in_inbox) where in_inbox and deleted_at is null;

alter table public.follow_up_tasks
  add column if not exists type text not null default 'task',
  add column if not exists priority text,
  add column if not exists duration_min integer,
  add column if not exists done_at timestamptz,
  add column if not exists location text;

-- Changelog ανά deal.
create table if not exists public.lead_changes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index if not exists lead_changes_lead_idx on public.lead_changes (lead_id, created_at desc);
alter table public.lead_changes enable row level security;
drop policy if exists lead_changes_read on public.lead_changes;
create policy lead_changes_read on public.lead_changes for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_changes.lead_id));

create or replace function public.leads_track_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  f text;
  o text;
  n text;
  fields text[] := array['title','value','status','stage','pipeline','assigned_to','expected_close_date','labels','budget_min','budget_max','source','lost_reason','preferred_project_id','archived_at'];
begin
  -- Ώρα won / lost.
  if new.status is distinct from old.status then
    if new.status::text = 'won' then new.won_at := coalesce(new.won_at, now()); new.lost_at := null; end if;
    if new.status::text in ('lost','nurture','no_response','retargeting','reactivation') then new.lost_at := coalesce(new.lost_at, now()); new.won_at := null; end if;
    if new.status::text not in ('won','lost','nurture','no_response','retargeting','reactivation') then new.won_at := null; new.lost_at := null; end if;
  end if;
  foreach f in array fields loop
    execute format('select ($1).%1$I::text, ($2).%1$I::text', f) into o, n using old, new;
    if o is distinct from n then
      insert into public.lead_changes (lead_id, actor_id, field, old_value, new_value)
      values (new.id, auth.uid(), f, o, n);
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists leads_track_changes on public.leads;
create trigger leads_track_changes before update on public.leads
  for each row execute function public.leads_track_changes();

-- Υπάρχοντα won/lost: ώρα από την τελευταία ενημέρωση.
update public.leads set won_at = coalesce(won_at, updated_at) where status::text = 'won' and won_at is null;
update public.leads set lost_at = coalesce(lost_at, updated_at) where status::text in ('lost','nurture','no_response','retargeting','reactivation') and lost_at is null;
