-- 0050_branding.sql — dynamic org branding (logo, colors, fonts).
--
-- A singleton row (id = 'org') holds the whole appearance config so the owner
-- can re-skin the entire OS — internal workbench, every portal, and the login
-- screen — from Settings → Branding without a deploy. Read by lib/branding.ts
-- (resilient: falls back to the built-in brand if this table/row is absent),
-- injected as CSS variables at the root layout.

create table if not exists public.org_branding (
  id            text primary key default 'org' check (id = 'org'),
  company_name  text not null default 'Oramira',
  logo_url      text,
  -- Core brand colors, stored as #RRGGBB. Shades are derived at render time.
  color_primary     text not null default '#1F3A30',  -- forest: sidebar, headings, primary actions
  color_accent      text not null default '#C8A86B',  -- champagne: active indicators, key figures
  color_secondary   text not null default '#E6DCC8',  -- sand: secondary surfaces
  color_background  text not null default '#F7F3EC',  -- stone: app resting surface
  color_text        text not null default '#2B2A27',  -- charcoal: primary text
  -- Curated font keys resolved against the catalog in lib/branding.ts.
  font_heading  text not null default 'source-serif',
  font_body     text not null default 'ibm-plex',
  -- Layout preferences, applied at the root layout (dynamic, no deploy).
  content_width text not null default 'standard',    -- standard | wide | full
  density       text not null default 'comfortable', -- comfortable | compact
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id)
);

-- Seed the singleton so getBranding() always has a row to read.
insert into public.org_branding (id) values ('org')
on conflict (id) do nothing;

alter table public.org_branding enable row level security;

-- Branding is public by nature (logo, company name, colors) so even the
-- unauthenticated login screen can be themed; only admins may WRITE it.
drop policy if exists org_branding_read on public.org_branding;
create policy org_branding_read on public.org_branding
  for select to anon, authenticated using (true);

drop policy if exists org_branding_write on public.org_branding;
create policy org_branding_write on public.org_branding
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
