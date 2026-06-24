-- Oramira OS — Migration 0004: Sales pipeline, homeowners, contractors,
-- investor holdings. This is the chain: Reservation -> Contract -> Payments
-- -> Homeowner -> Maintenance -> Contractor.

create table reservations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  buyer_contact_id uuid not null references contacts(id),
  reserved_at timestamptz default now(),
  deposit_amount numeric,
  deposit_paid boolean default false,
  status text default 'active',
  created_by uuid references profiles(id)
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  buyer_contact_id uuid not null references contacts(id),
  reservation_id uuid references reservations(id),
  status contract_status default 'draft',
  document_id uuid, -- FK added in 0005
  signed_at timestamptz,
  total_price numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table payment_schedules (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  installment_number int not null,
  description text,
  due_date date,
  amount numeric not null,
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  payment_schedule_id uuid references payment_schedules(id),
  contract_id uuid not null references contracts(id),
  amount_paid numeric not null,
  paid_at timestamptz default now(),
  method text,
  reference text,
  recorded_by uuid references profiles(id)
);

create table homeowners (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  unit_id uuid not null references units(id),
  moved_in_at date,
  created_at timestamptz default now()
);

create table contractors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  trade text,
  region text,
  is_available boolean default true,
  max_concurrent_assignments int default 5,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table profiles add constraint fk_profiles_contractor foreign key (contractor_id) references contractors(id);

create table maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid not null references homeowners(id),
  unit_id uuid not null references units(id),
  project_id uuid not null references projects(id),
  contractor_id uuid references contractors(id),
  title text not null,
  description text,
  status ticket_status default 'open',
  priority ticket_priority default 'medium',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz
);

create table ticket_photos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references maintenance_tickets(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table ticket_updates (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references maintenance_tickets(id) on delete cascade,
  author_id uuid references profiles(id),
  note text not null,
  status_change ticket_status,
  created_at timestamptz default now()
);

create table warranties (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  category text not null,
  starts_on date not null,
  ends_on date not null,
  notes text
);

create table construction_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  phase_id uuid references project_phases(id),
  contractor_id uuid references contractors(id),
  title text not null,
  description text,
  status text default 'pending',
  priority ticket_priority default 'medium',
  deadline date,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table contractor_performance_notes (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors(id),
  project_id uuid references projects(id),
  rating int,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table contractor_invoices (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors(id),
  project_id uuid references projects(id),
  amount numeric not null,
  document_id uuid, -- FK added in 0005
  status text default 'submitted',
  submitted_at timestamptz default now()
);

create table contractor_project_assignments (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors(id),
  project_id uuid not null references projects(id),
  trade text,
  assigned_at timestamptz default now(),
  unique (contractor_id, project_id)
);

create table project_team_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  role text not null, -- 'lawyer' | 'architect' | 'structural_engineer' | 'mep_engineer' | 'surveyor'
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz default now()
);

create table investor_holdings (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references investors(id),
  unit_id uuid references units(id),
  project_id uuid references projects(id),
  capital_invested numeric,
  ownership_percentage numeric,
  created_at timestamptz default now()
);

create table investor_projections (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references investor_holdings(id) on delete cascade,
  rental_yield_pct numeric,
  capital_appreciation_pct numeric,
  projected_roi numeric,
  projection_year int,
  created_at timestamptz default now()
);
