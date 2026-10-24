-- Oramira OS — Migration 0023: HR / personal employee workspace
-- Additive. Introduces the employee-facing data behind the new personal
-- Dashboard: employee profile fields, leave balances + requests, payslips, and
-- self-readable personal documents. Foundation for future payroll/leave
-- approval workflows. Each employee sees only their own; admin/management manage.

-- Employee profile fields
alter table profiles add column job_title text;
alter table profiles add column department text;
alter table profiles add column employment_start_date date;

-- Leave balances (per employee / type / year)
create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_type text not null default 'annual', -- annual | sick | unpaid
  year int not null,
  total_days numeric default 0,
  used_days numeric default 0,
  unique (profile_id, leave_type, year)
);

-- Leave requests (submitted by employee, decided by HR/admin)
create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_type text not null default 'annual',
  start_date date not null,
  end_date date not null,
  days numeric,
  reason text,
  status text default 'pending', -- pending | approved | rejected
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz default now()
);
create index idx_leave_requests_profile on leave_requests (profile_id, created_at desc);

-- Payslips
create table payslips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  period text not null,            -- e.g. '2026-06'
  gross_amount numeric,
  net_amount numeric,
  currency text default 'EUR',
  document_id uuid references documents(id),
  status text default 'issued',    -- draft | issued
  issued_at timestamptz default now()
);
create index idx_payslips_profile on payslips (profile_id, issued_at desc);

-- ===== RLS =====
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table payslips enable row level security;

-- helper: HR managers
-- (admin + management approve leave, issue payslips, set balances)
create or replace function is_hr_manager() returns boolean as $$
  select current_role() in ('admin', 'management');
$$ language sql stable security definer;

create policy leave_balances_self_read on leave_balances for select using (profile_id = auth.uid());
create policy leave_balances_hr_all on leave_balances for all using (is_hr_manager()) with check (is_hr_manager());

create policy leave_requests_self_read on leave_requests for select using (profile_id = auth.uid());
create policy leave_requests_self_insert on leave_requests for insert with check (profile_id = auth.uid());
create policy leave_requests_hr_all on leave_requests for all using (is_hr_manager()) with check (is_hr_manager());

create policy payslips_self_read on payslips for select using (profile_id = auth.uid());
create policy payslips_hr_all on payslips for all using (is_hr_manager()) with check (is_hr_manager());

-- Personal documents: an employee can read documents filed against their own
-- profile (entity_type 'profile', entity_id = their user id). HR/admin manage
-- via documents_staff_all (migration 0007).
create policy documents_self_profile_read on documents for select using (
  entity_type = 'profile' and entity_id = auth.uid()
);
