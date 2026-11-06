-- 0062_property_selections.sql — «Αποστολή επιλογής στον πελάτη» (βήμα 10 του πλάνου)
--
-- Ο πωλητής διαλέγει μονάδες στον Χάρτη και στέλνει στον πελάτη έναν
-- σύνδεσμο (/selection/<token>) που ανοίγει χωρίς σύνδεση. Ο πελάτης βλέπει
-- τις μονάδες και πατά «Θέλω προβολή» — ο πωλητής ειδοποιείται.
-- Ασφαλές να τρέξει ξανά.

create table if not exists public.property_selections (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  unit_ids uuid[] not null default '{}',
  message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days',
  first_viewed_at timestamptz,
  view_count int not null default 0,
  interested_unit_ids uuid[] not null default '{}'
);
create index if not exists idx_property_selections_lead on public.property_selections (lead_id);
alter table public.property_selections enable row level security;
drop policy if exists property_selections_staff_all on public.property_selections;
create policy property_selections_staff_all on public.property_selections for all using (is_staff()) with check (is_staff());
-- Η δημόσια σελίδα διαβάζει μέσω του server (service role), όχι απευθείας.
