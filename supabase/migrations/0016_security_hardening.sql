-- Oramira OS — Migration 0016: Security hardening (production audit)
-- Additive (don't edit 0001–0015).

-- The `organizations` table (migration 0002) was the only table left without
-- Row Level Security. In Postgres/PostgREST, a table WITHOUT RLS enabled is
-- readable/writable by any role that holds table privileges — i.e. every
-- authenticated user (buyer, contractor, …) could read and modify org-wide
-- notification settings. Lock it down to staff, matching every other table.
alter table organizations enable row level security;

create policy organizations_staff_all on organizations
  for all using (is_staff()) with check (is_staff());
