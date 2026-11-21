-- Περιγραφή και σημειώσεις σε κάθε έγγραφο (Property → Documents, ανά ακίνητο).
alter table public.documents add column if not exists description text;
alter table public.documents add column if not exists notes text;
