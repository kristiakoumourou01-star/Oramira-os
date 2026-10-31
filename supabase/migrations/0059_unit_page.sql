-- 0059_unit_page.sql — Σελίδα μονάδας (βήμα 8 του πλάνου)
--
-- Φωτογραφίες, βίντεο και κατόψεις ανά μονάδα, δωμάτια με διαστάσεις,
-- υπεύθυνος πωλητής, ποσοστό προμήθειας, και τοποθεσία έργου για τον χάρτη.
-- Ασφαλές να τρέξει ξανά (δεν σβήνει τίποτα).

create table if not exists public.unit_media (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'floor_plan', 'video_link')),
  bucket text not null default 'project-media',
  storage_path text,          -- αρχείο στο bucket (φωτογραφία, βίντεο, κάτοψη)
  url text,                   -- ή σύνδεσμος (YouTube / Vimeo / Matterport)
  caption text,
  sort int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (storage_path is not null or url is not null)
);
create index if not exists idx_unit_media_unit on public.unit_media (unit_id, sort);
alter table public.unit_media enable row level security;
drop policy if exists unit_media_staff_all on public.unit_media;
create policy unit_media_staff_all on public.unit_media for all using (is_staff()) with check (is_staff());

-- Δωμάτια: [{ "name": "Σαλόνι", "length": 5.2, "width": 4.1 }]
alter table public.units add column if not exists rooms jsonb not null default '[]'::jsonb;
alter table public.units add column if not exists responsible_agent_id uuid references public.profiles(id);
alter table public.units add column if not exists commission_pct numeric(5,2);

alter table public.projects add column if not exists latitude numeric(9,6);
alter table public.projects add column if not exists longitude numeric(9,6);
