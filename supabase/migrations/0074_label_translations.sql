-- Αυτόματες μεταφράσεις για ονόματα που γράφει η εταιρεία (στάδια, τμήματα,
-- πεδία, μενού…). Μία γραμμή ανά κείμενο και γλώσσα. Μόνο ο server (service
-- role) διαβάζει/γράφει· δεν υπάρχουν policies για χρήστες.
create table if not exists public.label_translations (
  src text not null,
  lang text not null check (lang in ('el', 'en', 'ru')),
  text text not null,
  created_at timestamptz not null default now(),
  primary key (src, lang)
);
alter table public.label_translations enable row level security;
