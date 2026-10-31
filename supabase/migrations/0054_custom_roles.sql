-- Oramira OS — Migration 0054: admin-defined roles
-- Additive. The roles themselves (name, permissions, special rights) live in
-- org_settings.data->roles; a user points at one with profiles.custom_role.
-- profiles.role stays the base type that row-level security relies on
-- (e.g. 'sales' = only own leads), so database protection is unchanged.

alter table profiles add column if not exists custom_role text;

comment on column profiles.custom_role is
  'Id of an admin-defined role in org_settings.data->roles.custom. NULL = the plain base role.';
