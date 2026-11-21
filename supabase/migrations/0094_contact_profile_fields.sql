-- Καρτέλα πελάτη (όπως στο FitnessCRM): προσωπικά στοιχεία, διεύθυνση,
-- επάγγελμα/εταιρεία, προτιμήσεις επικοινωνίας, φωτογραφία, σημειώσεις.
-- Additive, idempotent. Ο κώδικας δουλεύει και χωρίς αυτές τις στήλες.

alter table public.contacts add column if not exists first_name text;
alter table public.contacts add column if not exists last_name text;
alter table public.contacts add column if not exists gender text;            -- male | female | other
alter table public.contacts add column if not exists date_of_birth date;
alter table public.contacts add column if not exists id_number text;         -- ταυτότητα / διαβατήριο
alter table public.contacts add column if not exists member_code text;       -- κωδικός πελάτη
alter table public.contacts add column if not exists phone2 text;            -- σταθερό
alter table public.contacts add column if not exists fax text;
alter table public.contacts add column if not exists address text;
alter table public.contacts add column if not exists city text;
alter table public.contacts add column if not exists postcode text;
alter table public.contacts add column if not exists country text;           -- ISO alpha-2
alter table public.contacts add column if not exists profession text;
alter table public.contacts add column if not exists company text;
alter table public.contacts add column if not exists registered_at date;
alter table public.contacts add column if not exists receive_sms boolean not null default false;
alter table public.contacts add column if not exists receive_email boolean not null default false;
alter table public.contacts add column if not exists receive_push boolean not null default false;
alter table public.contacts add column if not exists photo_path text;        -- storage: contracts/contacts/<id>/photo-…
alter table public.contacts add column if not exists notes text;

-- GDPR: κανείς δεν «δέχεται» αυτόματα· οι υπάρχοντες πελάτες παίρνουν τη συγκατάθεση marketing που ήδη έχουν.
update public.contacts set receive_sms = true, receive_email = true, receive_push = true where marketing_opt_in is true;
