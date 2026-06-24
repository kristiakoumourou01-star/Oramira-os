-- Oramira OS — Migration 0008: Storage buckets
-- Split by sensitivity, not lumped into one bucket — see Phase 1.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('project-media', 'project-media', false, 26214400),       -- 25MB, gallery/floorplans
  ('contracts', 'contracts', false, 26214400),                 -- private, signed URLs only
  ('defect-reports', 'defect-reports', false, 15728640),       -- 15MB, homeowner ticket photos
  ('investor-documents', 'investor-documents', false, 26214400),
  ('contractor-invoices', 'contractor-invoices', false, 15728640)
on conflict (id) do nothing;

-- All buckets are private (public = false above); access is mediated
-- entirely through the `documents` table's RLS policies and signed URLs
-- generated server-side (lib/storage.ts), never a public bucket URL.

-- Storage-level policies: gate by whether the user can see the
-- corresponding `documents` row for that storage_path. This mirrors the
-- documents table RLS exactly, so a path is only ever fetchable if its
-- row would have been visible anyway.

create policy storage_staff_all on storage.objects for all using (
  bucket_id in ('project-media', 'contracts', 'defect-reports', 'investor-documents', 'contractor-invoices')
  and is_staff()
);

create policy storage_external_read on storage.objects for select using (
  exists (
    select 1 from documents d
    where d.bucket = storage.objects.bucket_id and d.storage_path = storage.objects.name
    -- relies on documents_external_read policy logic being satisfied for
    -- the same row when queried by the same user — Postgres evaluates RLS
    -- on the referenced table using the caller's own privileges, so this
    -- correctly inherits the documents-level access rules.
  )
);

create policy storage_contractor_write on storage.objects for insert with check (
  bucket_id in ('defect-reports', 'contractor-invoices')
  and current_contractor_id() is not null
);

create policy storage_homeowner_write on storage.objects for insert with check (
  bucket_id = 'defect-reports' and current_contact_id() is not null
);
