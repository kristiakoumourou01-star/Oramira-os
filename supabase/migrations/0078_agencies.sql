-- Συνεργαζόμενα agencies (μεσιτικά γραφεία) και ποια ακίνητα πουλάνε:
-- ολόκληρο έργο ή συγκεκριμένες μονάδες, με προμήθεια και αποκλειστικότητα.
create table if not exists agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  default_commission_pct numeric,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists agency_listings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  unit_id uuid references units(id) on delete cascade,
  commission_pct numeric,
  exclusive boolean not null default false,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  constraint agency_listings_scope check (project_id is not null or unit_id is not null)
);
create index if not exists idx_agency_listings_project on agency_listings (project_id);
create index if not exists idx_agency_listings_unit on agency_listings (unit_id);

-- Ποιο agency έφερε τον αγοραστή στην κράτηση / πώληση.
alter table reservations add column if not exists agency_id uuid references agencies(id) on delete set null;

alter table agencies enable row level security;
alter table agency_listings enable row level security;
create policy agencies_staff_all on agencies for all using (is_staff()) with check (is_staff());
create policy agency_listings_staff_all on agency_listings for all using (is_staff()) with check (is_staff());
