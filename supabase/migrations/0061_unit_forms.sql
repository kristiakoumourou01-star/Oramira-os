-- 0061_unit_forms.sql — Φόρμες μονάδων με δικά σας πεδία (βήμα 9 του πλάνου)
-- Τιμές των πεδίων ανά μονάδα και τι ζητά κάθε αγοραστής (για το matching).
-- Οι ορισμοί των πεδίων ζουν στις Ρυθμίσεις (org_settings → unitForms).
-- Ασφαλές να τρέξει ξανά.
alter table public.units add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.leads add column if not exists unit_requirements jsonb not null default '{}'::jsonb;
