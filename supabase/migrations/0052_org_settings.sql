-- 0052_org_settings.sql — agency-wide settings store (prototype Settings area).
--
-- One singleton row holds every non-branding settings domain as JSONB slices
-- (business, invoices, notifications, security, tags, pipelines, gdpr, layout,
-- dashboard). A flexible JSONB store means new sections need no schema change —
-- each saves its own slice. Branding stays in its own table (org_branding) since
-- it is public-readable for the login screen; org_settings is admin-only.
--
-- Read by lib/org-settings.ts (resilient: missing table/row → built-in defaults).

create table if not exists public.org_settings (
  id          text primary key default 'org' check (id = 'org'),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

insert into public.org_settings (id) values ('org')
on conflict (id) do nothing;

alter table public.org_settings enable row level security;

-- Any signed-in staff may READ settings (needed for company footer on invoices,
-- pipeline config, etc.); only admins may WRITE.
drop policy if exists org_settings_read on public.org_settings;
create policy org_settings_read on public.org_settings
  for select to authenticated using (true);

drop policy if exists org_settings_write on public.org_settings;
create policy org_settings_write on public.org_settings
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
