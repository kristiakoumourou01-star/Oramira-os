-- Oramira OS — Migration 0047: Acquisition platform (map, DD, docs, offer, seller)
-- Extends land_parcels (does not rebuild it): map coordinates, a due-diligence
-- checklist, offer-calculator inputs, and expanded seller-intelligence signals.
-- Adds a parcel_documents registry (vault). All additive.

alter table land_parcels
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists due_diligence jsonb not null default '{}'::jsonb,   -- { ownership_verified: true, ... }
  add column if not exists offer_inputs jsonb,                                  -- offer calculator inputs
  add column if not exists relocation boolean not null default false,
  add column if not exists divorce boolean not null default false,
  add column if not exists debt_pressure boolean not null default false,
  add column if not exists timeline_to_sell text;   -- asap | 3_months | 6_months | 12_months | flexible

-- Document vault — a registry of deeds/surveys/planning/valuations/etc. per parcel.
create table if not exists parcel_documents (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references land_parcels(id) on delete cascade,
  category text not null,   -- title_deed | survey | planning | valuation | photo | email | legal | agreement | other
  name text not null,
  url text,                 -- storage path or external link
  note text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists parcel_documents_parcel_idx on parcel_documents (parcel_id);

alter table parcel_documents enable row level security;
create policy parcel_documents_staff_all on parcel_documents for all using (is_staff()) with check (is_staff());
