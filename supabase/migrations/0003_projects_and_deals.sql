-- Oramira OS — Migration 0003: Projects, buildings, phases, units, deals

create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  name text not null,
  slug text unique,
  location text,
  description text,
  status text default 'planning',
  cover_image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table buildings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  floors int,
  created_at timestamptz default now()
);

create table project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  sequence int default 1,
  created_at timestamptz default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  building_id uuid references buildings(id),
  phase_id uuid references project_phases(id),
  unit_number text not null,
  floor int,
  type text,
  sqm numeric,
  price numeric,
  floorplan_document_id uuid, -- FK added in 0005 once documents exists
  status unit_status default 'available',
  buyer_contact_id uuid references contacts(id),
  handover_status text default 'pending',
  handover_date date,
  warranty_start_date date,
  warranty_period_months int default 24,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, unit_number)
);

create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references project_phases(id),
  milestone_type phase_type not null,
  status milestone_status default 'not_started',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Now that projects exists, attach the deferred FKs from migration 0002
alter table leads add constraint fk_leads_preferred_project foreign key (preferred_project_id) references projects(id);
alter table website_submissions add constraint fk_submissions_project foreign key (project_interest_id) references projects(id);

create table deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id),
  created_by uuid references profiles(id),

  plot_size_sqm numeric,
  building_density numeric,
  coverage_ratio numeric,
  floors int,
  height_m numeric,
  zone text,
  sale_price_per_sqm numeric,
  construction_cost_per_sqm numeric,
  land_acquisition_cost numeric,
  permit_fees numeric,
  architect_fees numeric,
  engineering_fees numeric,
  finance_cost numeric,
  legal_fees numeric,
  marketing_cost numeric,
  vat_rate numeric,
  contingency_rate numeric,

  total_buildable_sqm numeric,
  sellable_sqm numeric,
  estimated_units int,
  gdv numeric,
  total_project_cost numeric,
  net_profit numeric,
  roi numeric,
  profit_margin numeric,
  break_even_sqm numeric,
  revenue_per_unit numeric,
  risk_score int,

  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table deal_scenarios (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  name text not null,
  overrides jsonb not null,
  computed_outputs jsonb not null,
  created_at timestamptz default now()
);
