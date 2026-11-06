-- Oramira OS — Migration 0053: per-user permissions + admin-created accounts
-- Additive (don't edit earlier migrations).
--
-- 1. profiles.permissions — optional per-user access matrix chosen by the admin
--    in Settings → Users. Shape: {"leads": ["view","edit"], "projects": ["view"]}.
--    NULL = the user follows their role's defaults (lib/permissions.ts).
--    When set, it REPLACES the role defaults for that user (grants and removals).
-- 2. profiles.must_change_password — set when an admin creates the account with
--    a temporary password; the user is sent to /account/password on first login.

alter table profiles add column if not exists permissions jsonb;
alter table profiles add column if not exists must_change_password boolean not null default false;

comment on column profiles.permissions is
  'Per-user access matrix set by an admin. NULL = role defaults. {"module": ["view","edit","delete","assign"]}';
comment on column profiles.must_change_password is
  'True after an admin sets a temporary password; cleared when the user changes it.';
