-- Oramira OS — Migration 0010: Projects & Units Management module
-- Additive enhancements on top of the foundation (don't edit 0001–0009).
-- The structural tables (projects, buildings, project_phases, units,
-- project_milestones, reservations, contracts, payment_schedules,
-- contractor_project_assignments) already exist — this migration fills in
-- the inventory-layer attributes the module surfaces and adds reservation
-- expiration + conversion plumbing. No new tables, so existing RLS in 0007
-- continues to cover every row touched here.

-- ===== Units: richer inventory attributes =====
alter table units add column bedrooms int;
alter table units add column bathrooms numeric(3, 1);
alter table units add column internal_specs jsonb default '{}';
alter table units add column description text;

-- ===== Phases can belong to a specific building =====
-- "Multiple phases per building" — a phase still rolls up to its project,
-- but may now be scoped to one building. Nullable so the project-level
-- phases created before this migration stay valid.
alter table project_phases add column building_id uuid references buildings(id);

-- ===== Reservation expiration + conversion =====
-- A reservation holds a unit for a fixed window; if the deposit isn't
-- confirmed before it lapses, the hold is released back to inventory.
alter table reservations add column expires_at timestamptz;
alter table reservations add column expired_at timestamptz;
alter table reservations add column converted_contract_id uuid references contracts(id);

-- Releases stale reservations: any ACTIVE hold past its expiry with no
-- deposit confirmed is marked expired and its unit returned to 'available'.
-- Read-only-ish: it never touches a reservation whose deposit is paid, and
-- never downgrades a unit that has already progressed past 'reserved'.
-- Staff or the Automation Center cron invoke it; returns the number of
-- units released.
create or replace function expire_stale_reservations() returns int as $$
declare
  v_released int;
begin
  with lapsed as (
    update reservations r
      set status = 'expired', expired_at = now()
      where r.status = 'active'
        and r.deposit_paid = false
        and r.expires_at is not null
        and r.expires_at < now()
      returning r.unit_id
  )
  update units u
    set status = 'available', buyer_contact_id = null, updated_at = now()
    where u.id in (select unit_id from lapsed) and u.status = 'reserved';
  get diagnostics v_released = row_count;
  return v_released;
end;
$$ language plpgsql security definer;

-- Helpful indexes for the inventory grid and expiry sweep.
create index idx_units_project_status on units (project_id, status);
create index idx_reservations_unit on reservations (unit_id);
create index idx_reservations_expiry on reservations (status, expires_at) where status = 'active';
