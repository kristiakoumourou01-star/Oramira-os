-- Oramira OS — Migration 0024: Property Management (post-sale owner lifecycle)
-- Additive. Extends the existing homeowner/unit model — NOT a separate module.

-- Occupancy status on each unit.
alter table units add column occupancy_status text default 'vacant'; -- owner_occupied | rented | vacant

-- Owner-facing project info (shown to homeowners on their Project page).
alter table projects add column delivery_date date;
alter table projects add column common_areas text;
alter table projects add column maintenance_schedule text;
alter table projects add column management_contact text;
alter table projects add column emergency_contact text;

-- Ownership transfer history per unit.
create table unit_ownership_history (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  previous_contact_id uuid references contacts(id),
  new_contact_id uuid references contacts(id),
  transfer_date date default now(),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index idx_ownership_history_unit on unit_ownership_history (unit_id, created_at desc);

alter table unit_ownership_history enable row level security;
create policy ownership_history_staff_all on unit_ownership_history for all using (is_staff()) with check (is_staff());
-- The current owner/buyer can see their own unit's history.
create policy ownership_history_owner_read on unit_ownership_history for select using (
  owns_unit_as_homeowner(unit_id) or owns_unit_as_buyer(unit_id)
);
