-- Oramira OS — Migration 0028: HR depth — payroll, onboarding, contracts
-- Additive (don't edit earlier migrations).

-- ── Employee compensation + work profile (on profiles) ──
alter table profiles add column work_schedule text;        -- 5_day | 6_day
alter table profiles add column agreed_salary numeric;
alter table profiles add column salary_basis text;          -- net | gross
alter table profiles add column commission_pct numeric;
alter table profiles add column annual_leave_days numeric;
alter table profiles add column sick_leave_days numeric;

-- ── Onboarding config carried on the invite until acceptance ──
alter table invites add column onboarding jsonb default '{}';

-- ── Payslip breakdown ──
alter table payslips add column employer_cost numeric;
alter table payslips add column total_deductions numeric;
alter table payslips add column bonus numeric default 0;
alter table payslips add column commission numeric default 0;
alter table payslips add column advances numeric default 0;
alter table payslips add column payment_date date;
alter table payslips add column breakdown jsonb default '{}'; -- full computed structure
alter table payslips add column approved_by uuid references profiles(id);
alter table payslips add column approved_at timestamptz;

-- ── Employment contracts ──
create table employee_contracts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'contract', -- contract | amendment | nda | agreement
  title text not null,
  document_id uuid references documents(id),
  status text default 'active',          -- active | inactive
  start_date date,
  expiry_date date,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index idx_employee_contracts_profile on employee_contracts (profile_id);
alter table employee_contracts enable row level security;
create policy employee_contracts_self_read on employee_contracts for select using (profile_id = auth.uid());
create policy employee_contracts_hr_all on employee_contracts for all using (is_hr_manager()) with check (is_hr_manager());

-- ── accept_invite: apply onboarding config + seed leave balances ──
create or replace function accept_invite(invite_token text, new_user_id uuid)
returns void as $$
declare
  inv invites;
  o jsonb;
  yr int := extract(year from now());
begin
  select * into inv from invites where token = invite_token and status = 'pending' and expires_at > now();
  if inv is null then
    raise exception 'Invalid or expired invite';
  end if;
  o := coalesce(inv.onboarding, '{}'::jsonb);

  insert into profiles (id, contact_id, contractor_id, role, full_name,
    job_title, employment_start_date, work_schedule, agreed_salary, salary_basis, commission_pct,
    annual_leave_days, sick_leave_days)
  values (
    new_user_id,
    case when inv.role <> 'contractor' then inv.contact_id else null end,
    case when inv.role = 'contractor' then inv.related_entity_id else null end,
    inv.role,
    coalesce(o->>'full_name', (select full_name from contacts where id = inv.contact_id)),
    nullif(o->>'position', ''),
    nullif(o->>'start_date', '')::date,
    nullif(o->>'work_schedule', ''),
    nullif(o->>'agreed_salary', '')::numeric,
    nullif(o->>'salary_basis', ''),
    nullif(o->>'commission_pct', '')::numeric,
    nullif(o->>'annual_leave_days', '')::numeric,
    nullif(o->>'sick_leave_days', '')::numeric
  );

  if coalesce((o->>'annual_leave_days')::numeric, 0) > 0 then
    insert into leave_balances (profile_id, leave_type, year, total_days)
    values (new_user_id, 'annual', yr, (o->>'annual_leave_days')::numeric)
    on conflict (profile_id, leave_type, year) do nothing;
  end if;
  if coalesce((o->>'sick_leave_days')::numeric, 0) > 0 then
    insert into leave_balances (profile_id, leave_type, year, total_days)
    values (new_user_id, 'sick', yr, (o->>'sick_leave_days')::numeric)
    on conflict (profile_id, leave_type, year) do nothing;
  end if;

  update invites set status = 'accepted', accepted_at = now() where id = inv.id;
end;
$$ language plpgsql security definer;
