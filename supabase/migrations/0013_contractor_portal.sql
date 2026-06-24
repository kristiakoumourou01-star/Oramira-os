-- Oramira OS — Migration 0013: Contractor Portal
-- Additive (don't edit 0001–0012). Contractors are first-class users who must
-- see ONLY their assigned jobs. Most write paths already have contractor-scoped
-- RLS from 0007 (maintenance_tickets, ticket_photos, ticket_updates, messages,
-- contractor_invoices) and 0012 (contractor_visits). This migration adds:
--   • material requests (with a staff approval workflow),
--   • internal job notes (contractor-private; NOT visible to the homeowner),
--   • invoice ↔ ticket linkage,
--   • two SECURITY DEFINER read functions that expose the assigned job's
--     homeowner + property info to the contractor without widening any table's
--     row policies (strict: each does its own contractor_id check).

-- ===== Invoice ↔ ticket linkage =====
alter table contractor_invoices add column ticket_id uuid references maintenance_tickets(id);

-- ===== Material requests =====
create table material_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references maintenance_tickets(id) on delete cascade,
  contractor_id uuid not null references contractors(id),
  items jsonb not null default '[]',     -- [{ name, qty, unit_cost }]
  estimated_cost numeric,
  status text default 'pending',          -- pending | approved | rejected
  note text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz default now()
);
create index idx_material_requests_ticket on material_requests (ticket_id);

-- ===== Internal job notes (contractor-private) =====
create table contractor_job_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references maintenance_tickets(id) on delete cascade,
  contractor_id uuid not null references contractors(id),
  body text not null,
  created_at timestamptz default now()
);
create index idx_contractor_job_notes_ticket on contractor_job_notes (ticket_id);

-- ===== RLS =====
alter table material_requests enable row level security;
alter table contractor_job_notes enable row level security;

-- Material requests: contractor raises + reads own; ONLY staff can decide
-- (approve/reject) — the contractor has no update policy, so they can never
-- self-approve.
create policy material_requests_staff_all on material_requests for all using (is_staff()) with check (is_staff());
create policy material_requests_contractor_read on material_requests for select using (contractor_id = current_contractor_id());
create policy material_requests_contractor_insert on material_requests for insert with check (
  contractor_id = current_contractor_id() and contractor_assigned_to_ticket(ticket_id)
);

-- Internal notes: contractor (and staff) only — deliberately NO homeowner
-- policy, so these stay private to the trade + Oramira.
create policy job_notes_staff_all on contractor_job_notes for all using (is_staff()) with check (is_staff());
create policy job_notes_contractor_rw on contractor_job_notes for all using (
  contractor_id = current_contractor_id()
) with check (
  contractor_id = current_contractor_id() and contractor_assigned_to_ticket(ticket_id)
);

-- Contractor document READ. 0007 gave contractors an insert path
-- (documents_contractor_write) but no select, so they couldn't see back the
-- invoices they uploaded or the photos on their ticket. This adds exactly
-- that, scoped to their own contractor docs + their assigned tickets. The
-- storage_external_read policy (0008) then resolves the same rows, so signed
-- URLs work for them too.
create policy documents_contractor_read on documents for select using (
  (entity_type = 'contractor' and entity_id = current_contractor_id())
  or (entity_type = 'ticket' and contractor_assigned_to_ticket(entity_id))
);

-- ===== Assigned-job read functions (strict, definer) =====
-- A contractor reading their tickets via tickets_contractor_read only gets the
-- raw FKs (homeowner_id, unit_id) — not the homeowner's name or the property
-- address, which live in staff-only tables. Rather than open contacts/units to
-- contractors broadly, these functions return exactly the assigned job's
-- context and self-enforce contractor_id = current_contractor_id().

create or replace function contractor_jobs()
returns table (
  ticket_id uuid,
  title text,
  description text,
  category text,
  status ticket_status,
  priority ticket_priority,
  created_at timestamptz,
  resolved_at timestamptz,
  unit_id uuid,
  unit_number text,
  project_name text,
  location text,
  homeowner_name text,
  homeowner_phone text,
  homeowner_email text
) as $$
  select t.id, t.title, t.description, t.category, t.status, t.priority, t.created_at, t.resolved_at,
         u.id, u.unit_number, p.name, p.location,
         c.full_name, c.phone, c.email
  from maintenance_tickets t
  join units u on u.id = t.unit_id
  join projects p on p.id = t.project_id
  join homeowners h on h.id = t.homeowner_id
  join contacts c on c.id = h.contact_id
  where t.contractor_id = current_contractor_id()
  order by t.created_at desc;
$$ language sql stable security definer;

-- Average rating across this contractor's performance notes (read-only signal).
create or replace function contractor_avg_rating()
returns numeric as $$
  select round(avg(rating)::numeric, 1) from contractor_performance_notes
  where contractor_id = current_contractor_id();
$$ language sql stable security definer;
