-- Oramira OS — Migration 0012: Homeowner Portal
-- The post-handover lifecycle layer. Additive (don't edit 0001–0011).
-- Roles LAYER, they don't replace: the buyer read policies in 0007 are
-- contact-keyed (owns_unit_as_buyer → buyer_contact_id = current_contact_id),
-- not role-keyed, so a homeowner automatically retains their full buyer-era
-- access to contracts, payments, construction, documents, and handover —
-- nothing here revokes it. This migration only adds the after-sales pieces:
-- richer maintenance tickets, warranty-claim linkage, and contractor visits.

-- ===== Maintenance ticket enrichment =====
alter table maintenance_tickets add column category text;            -- issue type
alter table maintenance_tickets add column warranty_id uuid references warranties(id); -- set when a ticket is a warranty claim

-- ===== Contractor visits (scheduling + visit history) =====
create table contractor_visits (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references maintenance_tickets(id) on delete cascade,
  unit_id uuid not null references units(id),
  contractor_id uuid references contractors(id),
  scheduled_for timestamptz,
  completed_at timestamptz,
  status text default 'scheduled', -- scheduled | en_route | completed | cancelled | rescheduled
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index idx_contractor_visits_unit on contractor_visits (unit_id);
create index idx_contractor_visits_ticket on contractor_visits (ticket_id);

alter table contractor_visits enable row level security;

-- Staff manage; the unit's homeowner (or buyer, pre-handover) sees the
-- schedule + visit history; the assigned contractor reads and updates theirs.
create policy contractor_visits_staff_all on contractor_visits for all using (is_staff()) with check (is_staff());
create policy contractor_visits_owner_read on contractor_visits for select using (
  owns_unit_as_homeowner(unit_id) or owns_unit_as_buyer(unit_id)
);
create policy contractor_visits_contractor_rw on contractor_visits for all using (
  contractor_id = current_contractor_id()
) with check (
  contractor_id = current_contractor_id()
);
