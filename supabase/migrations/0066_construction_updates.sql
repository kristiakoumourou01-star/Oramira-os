-- Oramira OS — Migration 0066: ενημερώσεις κατασκευής με φωτογραφίες (βήμα 11γ)
-- Το προσωπικό δημοσιεύει ενημερώσεις (έργο / κτίριο / μονάδα) με κείμενο,
-- ποσοστό προόδου και φωτογραφίες· οι αγοραστές τις βλέπουν στο portal.
-- Additive, ασφαλές να τρέξει ξανά.
create table if not exists construction_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  building_id uuid references buildings(id) on delete set null,
  unit_id uuid references units(id) on delete cascade,
  title text not null,
  body text,
  progress integer check (progress between 0 and 100),
  milestone_type text,
  -- [{ path, caption }] in the project-media bucket
  photos jsonb not null default '[]'::jsonb,
  visible_to_buyers boolean not null default true,
  notified_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists construction_updates_project_idx on construction_updates (project_id, created_at desc);
create index if not exists construction_updates_unit_idx on construction_updates (unit_id) where unit_id is not null;
alter table construction_updates enable row level security;

drop policy if exists construction_updates_staff_all on construction_updates;
create policy construction_updates_staff_all on construction_updates for all using (is_staff()) with check (is_staff());

-- Buyers / homeowners: visible updates for their own unit's project, narrowed
-- to their building or unit when the update is scoped.
drop policy if exists construction_updates_owner_read on construction_updates;
create policy construction_updates_owner_read on construction_updates for select using (
  visible_to_buyers and exists (
    select 1 from units u
    where u.project_id = construction_updates.project_id
      and (construction_updates.unit_id is null or construction_updates.unit_id = u.id)
      and (construction_updates.building_id is null or construction_updates.building_id = u.building_id)
      and (
        u.buyer_contact_id = current_contact_id()
        or exists (select 1 from homeowners h where h.unit_id = u.id and h.contact_id = current_contact_id())
      )
  )
);
notify pgrst, 'reload schema';
