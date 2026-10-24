-- Oramira OS — Migration 0032: Interactive Development Map
-- Detailed unit specifications and a project_media library (masterplans,
-- architectural drawings, floor plans, renders, block layouts) that powers the
-- interactive Block → Floor → Unit map for staff and owners. Additive.

-- ── Unit specification breakdown ──
alter table units add column internal_sqm numeric;
alter table units add column covered_veranda_sqm numeric;
alter table units add column uncovered_veranda_sqm numeric;
alter table units add column storage_sqm numeric;
alter table units add column parking_spaces integer;

-- ── Project media library (plans / renders) ──
create table project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  building_id uuid references buildings(id) on delete set null, -- block scope (optional)
  floor integer,                 -- floor scope (optional, for floor plans)
  kind text not null,            -- masterplan | architectural | floor_plan | render | block_layout
  title text,
  bucket text not null default 'project-media',
  storage_path text not null,
  sort integer default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index idx_project_media_project on project_media (project_id, kind);
create index idx_project_media_building on project_media (building_id);
alter table project_media enable row level security;

-- Staff manage everything.
create policy project_media_staff_all on project_media for all using (is_staff()) with check (is_staff());

-- Owners (buyers/homeowners) may read media for a project where they hold a unit,
-- so the after-sales portal can render the development they belong to.
create policy project_media_owner_read on project_media for select using (
  exists (
    select 1 from units u
    where u.project_id = project_media.project_id
      and (
        u.buyer_contact_id = current_contact_id()
        or exists (select 1 from homeowners h where h.unit_id = u.id and h.contact_id = current_contact_id())
      )
  )
);
