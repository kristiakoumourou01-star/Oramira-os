-- Oramira OS — Migration 0029: HR finalization
-- Stored payslip PDFs, contract reminder dates, and sales commissions.

-- Private bucket for generated HR files (payslip PDFs). All access is via
-- service-role server actions guarded by payslip RLS — no public/storage policy
-- needed (employees never touch storage directly).
insert into storage.buckets (id, name, public, file_size_limit)
values ('hr-documents', 'hr-documents', false, 10485760)
on conflict (id) do nothing;

-- Payslip stored-PDF location
alter table payslips add column pdf_path text;

-- Contract reminder dates
alter table employee_contracts add column probation_end_date date;
alter table employee_contracts add column renewal_date date;

-- ── Sales commissions ──
create table commissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade, -- the agent
  lead_id uuid references leads(id),
  unit_id uuid references units(id),
  reservation_id uuid references reservations(id),
  base_value numeric,         -- deal / unit value
  commission_pct numeric,
  amount numeric,
  status text default 'pending', -- pending | paid
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index idx_commissions_profile on commissions (profile_id, created_at desc);
alter table commissions enable row level security;
create policy commissions_self_read on commissions for select using (profile_id = auth.uid());
create policy commissions_hr_all on commissions for all using (is_hr_manager()) with check (is_hr_manager());
