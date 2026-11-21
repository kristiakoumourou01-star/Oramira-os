-- Αναφορές → Leads & πηγές: κόστος marketing ανά μήνα και πηγή, για «κόστος ανά lead».
create table if not exists marketing_spend (
  id uuid primary key default gen_random_uuid(),
  month date not null,          -- πρώτη μέρα του μήνα
  source text not null,         -- ίδιο κλειδί με leads.source (meta, google, website…)
  amount numeric not null default 0,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (month, source)
);
alter table marketing_spend enable row level security;
drop policy if exists marketing_spend_staff_all on marketing_spend;
create policy marketing_spend_staff_all on marketing_spend for all using (is_staff()) with check (is_staff());
