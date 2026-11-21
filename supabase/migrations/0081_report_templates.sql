-- Αποθηκευμένα πρότυπα για το Custom report (Reports → Custom report).
create table if not exists report_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'customers',
  definition jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table report_templates enable row level security;
create policy report_templates_staff_all on report_templates for all using (is_staff()) with check (is_staff());
