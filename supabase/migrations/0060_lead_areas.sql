-- 0060_lead_areas.sql — Matching αγοραστών με βάση την τοποθεσία
-- Οι περιοχές που θέλει κάθε αγοραστής (π.χ. {Λεμεσός, Γερμασόγεια}).
-- Ασφαλές να τρέξει ξανά.
alter table public.leads add column if not exists preferred_areas text[] not null default '{}';
create index if not exists idx_leads_preferred_areas on public.leads using gin (preferred_areas);
