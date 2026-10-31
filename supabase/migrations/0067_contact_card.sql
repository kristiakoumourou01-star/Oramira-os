-- Oramira OS — Migration 0067: καρτέλα επαφής (βήμα 12)
-- Προτιμώμενη ώρα επικοινωνίας, οικογένεια/συνεργάτες, έλεγχος ταυτότητας
-- και AML με βαθμό κινδύνου. Additive, ασφαλές να τρέξει ξανά.

alter table contacts add column if not exists best_time text;        -- any | morning | midday | afternoon | evening
alter table contacts add column if not exists best_time_note text;   -- π.χ. «όχι Παρασκευή», «μετά τις 18:00 ώρα Μόσχας»

-- ── Οικογένεια / συνεργάτες ──
create table if not exists contact_relations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  related_contact_id uuid references contacts(id) on delete set null,
  related_name text,                    -- όταν το πρόσωπο δεν είναι επαφή στο CRM
  related_phone text,
  related_email text,
  relation text not null,               -- spouse | partner | child | parent | sibling | relative | lawyer | accountant | agent | business_partner | other
  is_decision_maker boolean not null default false,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contact_relations_contact_idx on contact_relations (contact_id);
create index if not exists contact_relations_related_idx on contact_relations (related_contact_id) where related_contact_id is not null;
alter table contact_relations enable row level security;
drop policy if exists contact_relations_staff_all on contact_relations;
create policy contact_relations_staff_all on contact_relations for all using (is_staff()) with check (is_staff());

-- ── Έλεγχος ταυτότητας & AML (ένας φάκελος ανά επαφή) ──
create table if not exists contact_kyc (
  contact_id uuid primary key references contacts(id) on delete cascade,
  status text not null default 'not_started',   -- not_started | in_progress | verified | rejected
  person_type text not null default 'individual', -- individual | company | trust
  id_type text,                                 -- passport | id_card | residence_permit | company_registration
  id_number text,
  id_country text,                              -- ISO 3166-1 alpha-2
  id_expiry date,
  date_of_birth date,
  nationality text,                             -- ISO alpha-2
  residence_country text,                       -- ISO alpha-2
  address text,
  address_verified boolean not null default false,
  occupation text,
  pep text not null default 'no',               -- no | self | family | associate
  sanctions_checked_at timestamptz,
  sanctions_hit boolean not null default false,
  funds_source text,                            -- salary | business | property_sale | inheritance | investments | loan | savings | other
  funds_country text,                           -- ISO alpha-2
  funds_verified boolean not null default false,
  funds_note text,
  cash_payment boolean not null default false,
  third_party_payer boolean not null default false,
  remote_onboarding boolean not null default false,
  risk_score integer not null default 0,
  risk_level text not null default 'low',       -- low | medium | high | blocked
  risk_factors jsonb not null default '[]'::jsonb,
  review_due date,
  notes text,
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists contact_kyc_level_idx on contact_kyc (risk_level, review_due);
alter table contact_kyc enable row level security;
drop policy if exists contact_kyc_staff_all on contact_kyc;
create policy contact_kyc_staff_all on contact_kyc for all using (is_staff()) with check (is_staff());

-- ── GDPR: ένας επαληθευμένος φάκελος AML κρατείται υποχρεωτικά ──
create or replace function public.gdpr_legal_hold(p_contact uuid, p_years int) returns text as $$
declare
  v_cut timestamptz := now() - make_interval(years => greatest(coalesce(p_years, 6), 0));
begin
  if public._gdpr_count('select count(*) from public.profiles where contact_id = $1', p_contact) > 0 then
    return 'Η επαφή έχει λογαριασμό στο σύστημα (portal ή προσωπικό). Απενεργοποιήστε πρώτα τον λογαριασμό από τους Χρήστες.';
  end if;
  if public._gdpr_count(format(
      'select count(*) from public.contracts where buyer_contact_id = $1 and status::text <> %L and coalesce(signed_at, created_at) > %L',
      'cancelled', v_cut), p_contact) > 0 then
    return format('Υπάρχει συμβόλαιο των τελευταίων %s ετών. Τα στοιχεία κρατούνται υποχρεωτικά (AML / φορολογικά).', p_years);
  end if;
  if public._gdpr_count(format('select count(*) from public.invoices where contact_id = $1 and issue_date > %L', v_cut::date), p_contact) > 0 then
    return format('Υπάρχει τιμολόγιο των τελευταίων %s ετών. Τα στοιχεία κρατούνται υποχρεωτικά (φορολογικά).', p_years);
  end if;
  if public._gdpr_count(format('select count(*) from public.contact_kyc where contact_id = $1 and status = %L and verified_at > %L', 'verified', v_cut), p_contact) > 0 then
    return format('Υπάρχει επαληθευμένος φάκελος AML των τελευταίων %s ετών. Κρατείται υποχρεωτικά.', p_years);
  end if;
  if public._gdpr_count('select count(*) from public.reservations where buyer_contact_id = $1 and status = ''active''', p_contact) > 0 then
    return 'Υπάρχει ενεργή κράτηση μονάδας. Ακυρώστε ή ολοκληρώστε την πρώτα.';
  end if;
  if public._gdpr_count('select count(*) from public.homeowners where contact_id = $1', p_contact) > 0
     or public._gdpr_count('select count(*) from public.units where buyer_contact_id = $1', p_contact) > 0 then
    return 'Η επαφή είναι ιδιοκτήτης/αγοραστής μονάδας. Τα στοιχεία χρειάζονται για εγγυήσεις και συντήρηση.';
  end if;
  return null;
end;
$$ language plpgsql stable security definer set search_path = public;

-- Μετά από κάθε ανωνυμοποίηση: σβήνονται και οι σχέσεις, ο (μη δεσμευτικός)
-- φάκελος KYC και οι προτιμήσεις επικοινωνίας της επαφής.
create or replace function public.gdpr_cleanup_contact_extras() returns trigger as $$
begin
  delete from public.contact_relations where contact_id = new.contact_id;
  update public.contact_relations set related_contact_id = null, related_name = 'Διαγραμμένη επαφή', related_phone = null, related_email = null
   where related_contact_id = new.contact_id;
  delete from public.contact_kyc where contact_id = new.contact_id;
  update public.contacts set best_time = null, best_time_note = null, preferred_language = null where id = new.contact_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_gdpr_cleanup_contact_extras on gdpr_erasures;
create trigger trg_gdpr_cleanup_contact_extras after insert on gdpr_erasures
  for each row execute function gdpr_cleanup_contact_extras();

notify pgrst, 'reload schema';
