-- Oramira OS — Migration 0095: Projects & Property — origin links, unit history,
-- rentals, owner charges and annual maintenance fees. Additive + idempotent.
--
-- 1. Land → Deal Analyzer → Project: a project remembers where it came from
--    (source parcel / source analysis) and a parcel remembers its project.
-- 2. Unit history: ownership transfers carry a kind + price; rentals
--    (tenancies) are stored per unit with tenant, rent and dates.
-- 3. Property management: charges to a unit's owner (service requests,
--    annual maintenance fee, other) and an annual maintenance fee per unit.

-- ── 1. Origin links ────────────────────────────────────────────────────────
alter table projects add column if not exists source_parcel_id uuid references land_parcels(id) on delete set null;
alter table projects add column if not exists source_deal_id uuid references deals(id) on delete set null;
alter table land_parcels add column if not exists project_id uuid references projects(id) on delete set null;
alter table land_parcels add column if not exists deal_id uuid references deals(id) on delete set null;
create index if not exists land_parcels_project_idx on land_parcels (project_id);
create index if not exists projects_source_parcel_idx on projects (source_parcel_id);

-- ── 2. Ownership history enrichment ────────────────────────────────────────
-- kind: sale | resale | transfer | inheritance | removed
alter table unit_ownership_history add column if not exists kind text;
alter table unit_ownership_history add column if not exists price numeric;

-- Rentals: who rents the unit, from whom, for how much, and when.
create table if not exists unit_tenancies (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  owner_contact_id uuid references contacts(id) on delete set null,
  tenant_contact_id uuid references contacts(id) on delete set null,
  tenant_name text,
  start_date date,
  end_date date,
  monthly_rent numeric,
  deposit numeric,
  status text not null default 'active', -- active | ended | planned
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists unit_tenancies_unit_idx on unit_tenancies (unit_id, start_date desc);
create index if not exists unit_tenancies_tenant_idx on unit_tenancies (tenant_contact_id);

alter table unit_tenancies enable row level security;
drop policy if exists unit_tenancies_staff_all on unit_tenancies;
create policy unit_tenancies_staff_all on unit_tenancies for all using (is_staff()) with check (is_staff());
drop policy if exists unit_tenancies_owner_read on unit_tenancies;
create policy unit_tenancies_owner_read on unit_tenancies for select using (owns_unit_as_homeowner(unit_id));

-- ── 3. Owner charges + annual maintenance fee ──────────────────────────────
alter table units add column if not exists annual_maintenance_fee numeric;

create table if not exists unit_charges (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,   -- the owner who is charged
  ticket_id uuid references maintenance_tickets(id) on delete set null,
  kind text not null default 'service',                          -- service | maintenance_fee | other
  description text,
  amount numeric not null default 0,
  period_year int,                                               -- for maintenance_fee
  due_date date,
  status text not null default 'pending',                        -- pending | paid | cancelled
  paid_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists unit_charges_unit_idx on unit_charges (unit_id, created_at desc);
create index if not exists unit_charges_contact_idx on unit_charges (contact_id);
create index if not exists unit_charges_ticket_idx on unit_charges (ticket_id);
-- One annual fee per unit and year.
create unique index if not exists unit_charges_fee_year_uq on unit_charges (unit_id, period_year) where kind = 'maintenance_fee' and status <> 'cancelled';

alter table unit_charges enable row level security;
drop policy if exists unit_charges_staff_all on unit_charges;
create policy unit_charges_staff_all on unit_charges for all using (is_staff()) with check (is_staff());
drop policy if exists unit_charges_owner_read on unit_charges;
create policy unit_charges_owner_read on unit_charges for select using (owns_unit_as_homeowner(unit_id));
