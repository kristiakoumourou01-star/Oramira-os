-- Oramira OS — Migration 0064: εισαγωγή μονάδων από Excel (βήμα 11)
-- Κάθε εισαγωγή κρατά τι δημιούργησε και τις παλιές τιμές όσων άλλαξε,
-- ώστε να αναιρείται. Additive, ασφαλές να τρέξει ξανά.
create table if not exists unit_import_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_name text,
  created_units uuid[] not null default '{}',
  created_buildings uuid[] not null default '{}',
  -- [{ id, before: { column: old value, ..., custom_fields: {...} } }]
  updated jsonb not null default '[]'::jsonb,
  skipped integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references profiles(id) on delete set null,
  undo_note text
);
create index if not exists unit_import_batches_project_idx on unit_import_batches (project_id, created_at desc);
alter table unit_import_batches enable row level security;
drop policy if exists unit_import_batches_staff_all on unit_import_batches;
create policy unit_import_batches_staff_all on unit_import_batches for all using (is_staff()) with check (is_staff());
notify pgrst, 'reload schema';
