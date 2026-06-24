-- Oramira OS — Migration 0011: Buyer Portal
-- The first external-facing client surface. Additive (don't edit 0001–0010).
-- Most of what the portal reads already exists with buyer-scoped RLS from
-- 0007 (units, contracts, payments, payment_schedules, reservations,
-- project_milestones, documents, warranties). This migration fills the three
-- gaps the portal needs: buyer<->team messaging, announcements, and a
-- handover checklist — all designed to carry forward into the Homeowner
-- Portal unchanged.

-- ===== Title-deed process state on the unit =====
alter table units add column title_deed_status text default 'not_started';

-- ===== Announcements (project-scoped or global) =====
create table announcements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade, -- null = global
  title text not null,
  body text not null,
  audience text default 'all', -- 'all' | 'buyers' | 'homeowners' | 'investors'
  published_at timestamptz default now(),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index idx_announcements_project on announcements (project_id);

-- ===== Handover checklist (per unit) =====
create table handover_checklist_items (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  label text not null,
  description text,
  sequence int default 1,
  is_complete boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);
create index idx_handover_checklist_unit on handover_checklist_items (unit_id);

-- ===== RLS =====
alter table announcements enable row level security;
alter table handover_checklist_items enable row level security;

-- Announcements: staff manage; an external user sees global announcements
-- plus any for a project they're attached to (as buyer/homeowner owning a
-- unit, investor holding, or assigned contractor). Mirrors the project
-- external-read logic in 0007 so visibility stays consistent.
create policy announcements_staff_all on announcements for all using (is_staff()) with check (is_staff());
create policy announcements_external_read on announcements for select using (
  project_id is null
  or exists (
    select 1 from units u
    where u.project_id = announcements.project_id and (owns_unit_as_buyer(u.id) or owns_unit_as_homeowner(u.id))
  )
  or investor_holds_project(announcements.project_id)
  or contractor_assigned_to_project(announcements.project_id)
);

-- Handover checklist: staff manage; the unit's buyer or homeowner reads it.
create policy handover_checklist_staff_all on handover_checklist_items for all using (is_staff()) with check (is_staff());
create policy handover_checklist_owner_read on handover_checklist_items for select using (
  owns_unit_as_buyer(unit_id) or owns_unit_as_homeowner(unit_id)
);

-- Buyer <-> team messaging, keyed to the buyer's unit thread
-- (entity_type = 'unit'). Staff already have messages_staff_all to reply.
-- Carries forward to homeowners too (they keep buyer-era access per the
-- "roles layer, they don't replace" principle).
create policy messages_buyer_rw on messages for all using (
  entity_type = 'unit' and (owns_unit_as_buyer(entity_id) or owns_unit_as_homeowner(entity_id))
) with check (
  sender_id = auth.uid()
  and entity_type = 'unit'
  and (owns_unit_as_buyer(entity_id) or owns_unit_as_homeowner(entity_id))
);
