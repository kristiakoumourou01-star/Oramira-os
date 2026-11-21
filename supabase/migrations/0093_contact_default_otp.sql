-- Καρτέλα πελάτη → Επεξεργασία → MOBILE APP: προεπιλεγμένος κωδικός σύνδεσης (OTP).
-- Ένας σταθερός κωδικός που μπορεί να χρησιμοποιήσει ο πελάτης στην εφαρμογή
-- όταν δεν του έρχεται ο κωδικός με SMS / email.
--
-- Ασφάλεια: ο κωδικός αποθηκεύεται ΜΟΝΟ ως hash (bcrypt, pgcrypto) σε ξεχωριστό
-- πίνακα χωρίς καμία policy — ούτε το προσωπικό ούτε ο browser μπορούν να τον
-- διαβάσουν. Ορίζεται / καθαρίζεται / ελέγχεται μόνο μέσω των συναρτήσεων παρακάτω.

create extension if not exists pgcrypto;

create table if not exists public.contact_secrets (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  default_otp_hash text,
  default_otp_set_at timestamptz,
  default_otp_set_by uuid references public.profiles(id) on delete set null
);
alter table public.contact_secrets enable row level security;
revoke all on public.contact_secrets from anon, authenticated;

-- Ορισμός (ή καθαρισμός με κενό) από το προσωπικό πωλήσεων. 4–8 ψηφία.
create or replace function public.set_contact_default_otp(p_contact uuid, p_code text)
returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare v_at timestamptz;
begin
  if current_app_role()::text not in ('admin', 'management', 'sales') then
    raise exception 'not allowed';
  end if;
  if p_code is null or p_code = '' then
    update public.contact_secrets set default_otp_hash = null, default_otp_set_at = null, default_otp_set_by = auth.uid() where contact_id = p_contact;
    return null;
  end if;
  if p_code !~ '^[0-9]{4,8}$' then
    raise exception 'invalid code';
  end if;
  v_at := now();
  insert into public.contact_secrets (contact_id, default_otp_hash, default_otp_set_at, default_otp_set_by)
  values (p_contact, crypt(p_code, gen_salt('bf')), v_at, auth.uid())
  on conflict (contact_id) do update set default_otp_hash = excluded.default_otp_hash, default_otp_set_at = excluded.default_otp_set_at, default_otp_set_by = excluded.default_otp_set_by;
  return v_at;
end $$;
revoke all on function public.set_contact_default_otp(uuid, text) from public, anon;
grant execute on function public.set_contact_default_otp(uuid, text) to authenticated;

-- «Ορισμένος / Δεν έχει οριστεί» — μόνο η ημερομηνία, ποτέ ο κωδικός.
create or replace function public.contact_default_otp_status(p_contact uuid)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when is_staff() then (select default_otp_set_at from public.contact_secrets where contact_id = p_contact and default_otp_hash is not null) end;
$$;
revoke all on function public.contact_default_otp_status(uuid) from public, anon;
grant execute on function public.contact_default_otp_status(uuid) to authenticated;

-- Έλεγχος στη σύνδεση της εφαρμογής (μόνο από τον server, με service role):
-- επιστρέφει τον πελάτη αν ο κωδικός ταιριάζει με τον προεπιλεγμένο του.
create or replace function public.verify_contact_default_otp(p_contact uuid, p_code text)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select s.default_otp_hash = crypt(p_code, s.default_otp_hash)
    from public.contact_secrets s where s.contact_id = p_contact and s.default_otp_hash is not null), false);
$$;
revoke all on function public.verify_contact_default_otp(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_contact_default_otp(uuid, text) to service_role;
