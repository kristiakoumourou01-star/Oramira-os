-- 0057_gdpr.sql — GDPR & δεδομένα (βήμα 7ε του πλάνου)
--
-- 1. Συγκατάθεση: πότε, από πού και με ποιο κείμενο συμφώνησε κάθε επαφή,
--    και ξεχωριστά αν δέχεται marketing.
-- 2. Δικαίωμα διαγραφής: η επαφή ανωνυμοποιείται (όχι DELETE, γιατί συνδέεται
--    με προβολές, εργασίες κ.ά.). Σβήνονται όνομα, email, τηλέφωνο, σημειώσεις
--    και μηνύματα. ΔΕΝ γίνεται όσο υπάρχει νόμιμη υποχρέωση διατήρησης
--    (συμβόλαια/τιμολόγια μέσα στα χρόνια AML/φορολογίας, ενεργή κράτηση,
--    ιδιοκτήτης μονάδας, λογαριασμός χρήστη).
-- 3. Διατήρηση: leads χωρίς καμία κίνηση για Χ μήνες, που δεν έγιναν ποτέ
--    πελάτες, ανωνυμοποιούνται αυτόματα (αν το ενεργοποιήσει ο admin).
-- Κάθε διαγραφή καταγράφεται χωρίς προσωπικά στοιχεία (gdpr_erasures).
-- Ασφαλές να τρέξει ξανά (δεν σβήνει τίποτα).

alter table public.contacts add column if not exists consent_at timestamptz;
alter table public.contacts add column if not exists consent_source text;
alter table public.contacts add column if not exists consent_text text;
alter table public.contacts add column if not exists marketing_opt_in boolean not null default false;
alter table public.contacts add column if not exists marketing_opt_in_at timestamptz;
alter table public.contacts add column if not exists anonymized_at timestamptz;

create table if not exists public.gdpr_erasures (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null,
  mode text not null check (mode in ('request', 'retention')),
  reason text,
  erased_by uuid,
  erased_at timestamptz not null default now()
);
create index if not exists idx_gdpr_erasures_at on public.gdpr_erasures (erased_at desc);
alter table public.gdpr_erasures enable row level security;
drop policy if exists gdpr_erasures_read on public.gdpr_erasures;
create policy gdpr_erasures_read on public.gdpr_erasures for select
  using (current_app_role()::text = 'admin');

-- ── Βοηθητικά: ασφαλή απέναντι σε πίνακες/στήλες που ίσως λείπουν ─────────────
create or replace function public._gdpr_has(p_table text, p_col text default null) returns boolean as $$
  select case when p_col is null then to_regclass('public.' || p_table) is not null
    else exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = p_table and column_name = p_col) end;
$$ language sql stable;

create or replace function public._gdpr_count(p_sql text, p_id uuid) returns bigint as $$
declare n bigint;
begin
  execute p_sql into n using p_id;
  return coalesce(n, 0);
exception when undefined_table or undefined_column then
  return 0;
end;
$$ language plpgsql;

-- ── Γιατί δεν μπορεί (ακόμη) να διαγραφεί; null = μπορεί ───────────────────────
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

-- ── Ανωνυμοποίηση μίας επαφής ─────────────────────────────────────────────────
create or replace function public.anonymize_contact(p_contact uuid, p_actor uuid, p_mode text, p_reason text, p_years int)
returns void as $$
declare
  v_hold text;
  v_done timestamptz;
  v_set text := '';
  c record;
begin
  if p_mode not in ('request', 'retention') then raise exception 'Άγνωστος τρόπος διαγραφής.'; end if;
  select anonymized_at into v_done from public.contacts where id = p_contact for update;
  if not found then raise exception 'Η επαφή δεν βρέθηκε.'; end if;
  if v_done is not null then raise exception 'Η επαφή έχει ήδη διαγραφεί.'; end if;
  v_hold := public.gdpr_legal_hold(p_contact, p_years);
  if v_hold is not null then raise exception '%', v_hold; end if;

  -- contacts: μόνο οι στήλες που υπάρχουν
  for c in select * from (values
      ('email', format('%L', 'deleted-' || p_contact || '@anonymized.invalid')),
      ('full_name', quote_literal('Διαγραμμένη επαφή')),
      ('phone', 'null'), ('nationality', 'null'), ('buyer_type', 'null'),
      ('communication_preference', 'null'), ('nurture_style', 'null'),
      ('tags', '''{}'''), ('groups', '''{}'''), ('custom_fields', '''{}''::jsonb'),
      ('is_newsletter_subscriber', 'false'), ('marketing_opt_in', 'false'), ('marketing_opt_in_at', 'null'),
      ('consent_text', 'null'), ('anonymized_at', 'now()'), ('updated_at', 'now()')
    ) as t(col, expr) loop
    if public._gdpr_has('contacts', c.col) then
      v_set := v_set || case when v_set = '' then '' else ', ' end || format('%I = %s', c.col, c.expr);
    end if;
  end loop;
  execute format('update public.contacts set %s where id = $1', v_set) using p_contact;

  -- Ελεύθερα κείμενα που μπορεί να περιέχουν προσωπικά στοιχεία
  for c in select * from (values
      ('leads', 'contact_id', 'message'), ('leads', 'contact_id', 'ai_summary'),
      ('leads', 'contact_id', 'ai_score_reasoning'), ('leads', 'contact_id', 'ai_next_steps'),
      ('leads', 'contact_id', 'timeline_to_buy'),
      ('buyers', 'contact_id', 'notes'), ('investors', 'contact_id', 'notes'),
      ('follow_up_tasks', 'contact_id', 'note'), ('viewings', 'contact_id', 'notes')
    ) as t(tbl, key, col) loop
    if public._gdpr_has(c.tbl, c.col) and public._gdpr_has(c.tbl, c.key) then
      execute format('update public.%I set %I = null where %I = $1', c.tbl, c.col, c.key) using p_contact;
    end if;
  end loop;
  -- Καμία αυτόματη επικοινωνία πια: κλείνουν τα ανοιχτά leads και οι εργασίες.
  update public.leads set status = 'lost' where contact_id = p_contact and status::text not in ('won', 'lost');
  if public._gdpr_has('follow_up_tasks', 'is_done') then
    update public.follow_up_tasks set is_done = true where contact_id = p_contact and is_done is not true;
  end if;
  if public._gdpr_has('contact_communications', 'summary') then
    update public.contact_communications set summary = '[διαγράφηκε — GDPR]' where contact_id = p_contact;
  end if;
  if public._gdpr_has('website_submissions') then
    update public.website_submissions
       set name = null, phone = null, message = null, budget = null, email = 'deleted@anonymized.invalid'
     where contact_id = p_contact;
  end if;
  if public._gdpr_has('newsletter_subscribers') then
    delete from public.newsletter_subscribers where contact_id = p_contact;
  end if;
  if public._gdpr_has('calendar_events', 'related_client_id') then
    update public.calendar_events set related_client_id = null where related_client_id = p_contact;
  end if;
  if public._gdpr_has('land_parcels', 'contact_id') then
    update public.land_parcels set contact_id = null where contact_id = p_contact;
  end if;

  insert into public.gdpr_erasures (contact_id, mode, reason, erased_by)
  values (p_contact, p_mode, left(nullif(trim(coalesce(p_reason, '')), ''), 500), p_actor);
end;
$$ language plpgsql security definer set search_path = public;

-- ── Ποια leads έληξαν (διατήρηση) ─────────────────────────────────────────────
-- Επαφές που: δεν έχουν διαγραφεί, δεν έγιναν πελάτες (κανένα won lead,
-- καμία κράτηση/συμβόλαιο/τιμολόγιο/ιδιοκτησία/λογαριασμός), δεν είναι ενεργοί
-- συνδρομητές newsletter, και δεν είχαν καμία κίνηση εδώ και p_months μήνες.
create or replace function public.gdpr_retention_candidates(p_months int, p_limit int default 500)
returns table (contact_id uuid, last_activity timestamptz) as $$
declare
  v_cut timestamptz := now() - make_interval(months => greatest(coalesce(p_months, 24), 1));
begin
  return query
  with base as (
    select c.id, greatest(
        c.created_at,
        (select max(greatest(l.created_at, l.updated_at, coalesce(l.last_contacted_at, l.created_at))) from public.leads l where l.contact_id = c.id),
        (select max(cc.occurred_at) from public.contact_communications cc where cc.contact_id = c.id)
      ) as last_at
    from public.contacts c
    where c.anonymized_at is null
      and exists (select 1 from public.leads l where l.contact_id = c.id)
      and not exists (select 1 from public.leads l where l.contact_id = c.id and l.status::text = 'won')
      and not exists (select 1 from public.newsletter_subscribers n where n.contact_id = c.id and n.unsubscribed_at is null)
  )
  select b.id, b.last_at from base b
  where b.last_at < v_cut
    and public.gdpr_legal_hold(b.id, 100) is null   -- κανένας δεσμός, όσο παλιός κι αν είναι
    and public._gdpr_count('select count(*) from public.contracts where buyer_contact_id = $1', b.id) = 0
    and public._gdpr_count('select count(*) from public.reservations where buyer_contact_id = $1', b.id) = 0
    and public._gdpr_count('select count(*) from public.invoices where contact_id = $1', b.id) = 0
  order by b.last_at
  limit greatest(coalesce(p_limit, 500), 1);
end;
$$ language plpgsql stable security definer set search_path = public;

revoke all on function public.anonymize_contact(uuid, uuid, text, text, int) from public, anon, authenticated;
revoke all on function public.gdpr_retention_candidates(int, int) from public, anon, authenticated;
revoke all on function public.gdpr_legal_hold(uuid, int) from public, anon, authenticated;
grant execute on function public.anonymize_contact(uuid, uuid, text, text, int) to service_role;
grant execute on function public.gdpr_retention_candidates(int, int) to service_role;
grant execute on function public.gdpr_legal_hold(uuid, int) to service_role;
