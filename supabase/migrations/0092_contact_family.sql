-- Καρτέλα πελάτη → Επαφές & οικογενειακό δέντρο (όπως στο FitnessCRM).
-- Ο πίνακας contact_relations υπάρχει από το 0067· εδώ προστίθενται όνομα /
-- επώνυμο για εξωτερικές επαφές και ο σύνδεσμος με την «αντίστροφη» σχέση
-- (Πατέρας ↔ Γιος/Κόρη) όταν συνδέεται υπάρχων πελάτης. Additive, idempotent.

create table if not exists public.contact_relations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  related_contact_id uuid references public.contacts(id) on delete set null,
  related_name text,
  related_phone text,
  related_email text,
  relation text not null,
  is_decision_maker boolean not null default false,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.contact_relations add column if not exists first_name text;
alter table public.contact_relations add column if not exists last_name text;
-- Η αντίστοιχη γραμμή στην καρτέλα του άλλου πελάτη (διαγράφονται μαζί).
alter table public.contact_relations add column if not exists reciprocal_id uuid references public.contact_relations(id) on delete set null;

create index if not exists contact_relations_contact_idx on public.contact_relations (contact_id);
create index if not exists contact_relations_related_idx on public.contact_relations (related_contact_id) where related_contact_id is not null;
create index if not exists contact_relations_reciprocal_idx on public.contact_relations (reciprocal_id) where reciprocal_id is not null;

alter table public.contact_relations enable row level security;
drop policy if exists contact_relations_staff_all on public.contact_relations;
create policy contact_relations_staff_all on public.contact_relations for all using (is_staff()) with check (is_staff());
