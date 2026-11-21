-- Κόστος ανά πηγή leads (Διαχείριση leads → Agents): πόσα ξοδέψατε ανά μήνα σε
-- κάθε πηγή (Meta, Google, portals…). Από αυτό βγαίνει κόστος ανά lead και ανά
-- πώληση για κάθε agent. Χωρίς εγγραφές τα στατιστικά δείχνουν «—».

create table if not exists public.lead_source_costs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  month date not null,                 -- πρώτη μέρα του μήνα
  amount numeric not null default 0 check (amount >= 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source, month)
);

alter table public.lead_source_costs enable row level security;

drop policy if exists lead_source_costs_staff_read on public.lead_source_costs;
create policy lead_source_costs_staff_read on public.lead_source_costs for select using (is_staff());

drop policy if exists lead_source_costs_managers_write on public.lead_source_costs;
create policy lead_source_costs_managers_write on public.lead_source_costs for all
  using (current_app_role()::text in ('admin', 'management'))
  with check (current_app_role()::text in ('admin', 'management'));
