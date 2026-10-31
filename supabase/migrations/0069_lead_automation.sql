-- 0069 · Βήμα 14 — Leads: υπεύθυνος ανά πηγή, round robin, ενοποίηση διπλών
-- επαφών, επαναδιανομή αναπάντητων.
-- Οι ρυθμίσεις ζουν στο org_settings.data->'leadAutomation' (Ρυθμίσεις → Leads
-- & αυτοματισμοί). Χωρίς ρυθμίσεις όλα μένουν όπως πριν (routing off).

-- ── Ρυθμίσεις (μόνο για triggers / service role) ───────────────────────────
create or replace function public.lead_automation_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select data->'leadAutomation' from org_settings where id = 'org'), '{}'::jsonb);
$$;
revoke all on function public.lead_automation_settings() from public, anon, authenticated;

alter table public.leads add column if not exists auto_reassigned_at timestamptz;

-- ── Round robin ─────────────────────────────────────────────────────────────
-- Επόμενος = ο πωλητής της ομάδας που πήρε lead πιο παλιά (ή ποτέ). Παραλείπει
-- ανενεργούς και (αν ζητηθεί) όσους έχουν εγκεκριμένη άδεια σήμερα.
create or replace function public.pick_round_robin_agent(p_exclude uuid default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  cfg jsonb := lead_automation_settings()->'routing';
  v_pool uuid[];
  v_skip boolean := coalesce((cfg->>'skipOnLeave')::boolean, true);
  v_pick uuid;
begin
  -- Δύο leads την ίδια στιγμή δεν παίρνουν τον ίδιο πωλητή.
  perform pg_advisory_xact_lock(hashtext('oramira_lead_round_robin'));
  select array_agg(x::uuid) into v_pool
    from jsonb_array_elements_text(coalesce(cfg->'pool', '[]'::jsonb)) x
   where x ~ '^[0-9a-fA-F-]{36}$';
  if v_pool is null or cardinality(v_pool) = 0 then
    select array_agg(id) into v_pool from profiles where role::text = 'sales' and coalesce(is_active, true);
  end if;
  if v_pool is null then return null; end if;

  select p.id into v_pick
    from profiles p
   where p.id = any(v_pool)
     and coalesce(p.is_active, true)
     and p.id is distinct from p_exclude
     and (not v_skip or not exists (
           select 1 from leave_requests lr
            where lr.profile_id = p.id and lr.status = 'approved'
              and current_date between lr.start_date and lr.end_date))
   order by (select max(la.created_at) from lead_assignments la where la.assigned_to = p.id) asc nulls first,
            p.created_at, p.id
   limit 1;
  return v_pick;
end $$;
revoke all on function public.pick_round_robin_agent(uuid) from public, anon, authenticated;

-- ── Υπεύθυνος ανά πηγή (BEFORE INSERT, μετά το trg_a_lead_returning) ───────
create or replace function public.lead_route()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := lead_automation_settings()->'routing';
  rule jsonb;
  v_target text;
  v_agent text;
  v_skip boolean := coalesce((cfg->>'skipOnLeave')::boolean, true);
begin
  if new.assigned_to is not null then return new; end if;
  if not coalesce((cfg->>'enabled')::boolean, false) then return new; end if;

  select r into rule from jsonb_array_elements(coalesce(cfg->'rules', '[]'::jsonb)) r
   where r->>'source' = new.source::text limit 1;
  if rule is not null then
    v_target := coalesce(rule->>'target', 'none'); v_agent := rule->>'agentId';
  else
    v_target := coalesce(cfg->>'defaultTarget', 'none'); v_agent := cfg->>'defaultAgent';
  end if;

  if v_target = 'agent' and v_agent ~ '^[0-9a-fA-F-]{36}$' then
    if exists (select 1 from profiles p where p.id = v_agent::uuid and coalesce(p.is_active, true))
       and (not v_skip or not exists (select 1 from leave_requests lr where lr.profile_id = v_agent::uuid
             and lr.status = 'approved' and current_date between lr.start_date and lr.end_date)) then
      new.assigned_to := v_agent::uuid;
    else
      new.assigned_to := pick_round_robin_agent(null); -- ο υπεύθυνος λείπει → στην ομάδα
    end if;
  elsif v_target = 'round_robin' then
    new.assigned_to := pick_round_robin_agent(null);
  end if;
  return new;
end $$;

drop trigger if exists trg_b_lead_routing on public.leads;
create trigger trg_b_lead_routing before insert on public.leads
  for each row execute function public.lead_route();

-- Επιστρέφων πελάτης → στον πωλητή που του πούλησε (ρυθμίζεται).
create or replace function public.lead_mark_returning()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prev uuid;
begin
  if new.contact_id is null then return new; end if;
  if exists (select 1 from leads l where l.contact_id = new.contact_id and l.status::text = 'won' and l.id <> new.id)
     or exists (select 1 from units u where u.buyer_contact_id = new.contact_id)
     or exists (select 1 from homeowners h where h.contact_id = new.contact_id) then
    new.is_returning := true;
    if new.assigned_to is null
       and coalesce((lead_automation_settings()->'routing'->>'returningToPrevious')::boolean, true) then
      select l.assigned_to into v_prev from leads l
       where l.contact_id = new.contact_id and l.status::text = 'won' and l.assigned_to is not null
       order by l.updated_at desc nulls last limit 1;
      if v_prev is not null and exists (select 1 from profiles p where p.id = v_prev and coalesce(p.is_active, true)) then
        new.assigned_to := v_prev;
      end if;
    end if;
  end if;
  new.stage_entered_at := coalesce(new.stage_entered_at, now());
  return new;
end $$;

-- ── Διπλές επαφές ───────────────────────────────────────────────────────────
create table if not exists public.contact_duplicate_dismissals (
  a uuid not null references public.contacts(id) on delete cascade,
  b uuid not null references public.contacts(id) on delete cascade,
  dismissed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.contact_duplicate_dismissals enable row level security;
drop policy if exists dup_dismiss_staff on public.contact_duplicate_dismissals;
create policy dup_dismiss_staff on public.contact_duplicate_dismissals for all
  using (is_staff()) with check (is_staff());

create table if not exists public.contact_merges (
  id uuid primary key default gen_random_uuid(),
  kept_id uuid not null,
  dropped_id uuid not null,
  dropped_snapshot jsonb not null,
  merged_by uuid references public.profiles(id) on delete set null,
  merged_at timestamptz not null default now()
);
create index if not exists contact_merges_kept_idx on public.contact_merges (kept_id);
alter table public.contact_merges enable row level security;
drop policy if exists contact_merges_staff_read on public.contact_merges;
create policy contact_merges_staff_read on public.contact_merges for select using (is_staff());

-- Κλειδιά σύγκρισης: email (πεζά), τα 8 τελευταία ψηφία τηλεφώνου, όνομα.
create or replace function public.contact_match_keys(p_email text, p_phone text, p_name text)
returns text[] language sql immutable as $$
  select array_remove(array[
    case when nullif(trim(p_email), '') is not null then 'e:' || lower(trim(p_email)) end,
    case when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 8
         then 'p:' || right(regexp_replace(p_phone, '\D', '', 'g'), 8) end,
    case when length(trim(coalesce(p_name, ''))) >= 5 and position(' ' in trim(p_name)) > 0
         then 'n:' || lower(regexp_replace(trim(p_name), '\s+', ' ', 'g')) end
  ], null);
$$;

-- Πιθανά διπλά μιας επαφής (με RLS του χρήστη).
create or replace function public.find_duplicate_contacts(p_contact uuid)
returns table (contact_id uuid, full_name text, email text, phone text, reasons text[], created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  with me as (
    select id, contact_match_keys(email, phone, full_name) k from contacts where id = p_contact
  )
  select c.id, c.full_name, c.email, c.phone,
         array(select distinct left(x, 1) from unnest(contact_match_keys(c.email, c.phone, c.full_name)) x
                where x = any(me.k)) reasons,
         c.created_at
    from contacts c, me
   where c.id <> me.id
     and c.anonymized_at is null
     and contact_match_keys(c.email, c.phone, c.full_name) && me.k
     and not exists (select 1 from contact_duplicate_dismissals d
                      where d.a = least(c.id, me.id) and d.b = greatest(c.id, me.id))
   order by c.created_at
   limit 20;
$$;

-- Όλα τα ζευγάρια (σελίδα «Διπλές επαφές»).
create or replace function public.duplicate_contact_pairs(p_limit int default 200)
returns table (a uuid, b uuid, reasons text[])
language sql stable security invoker set search_path = public as $$
  with k as (
    select c.id, unnest(contact_match_keys(c.email, c.phone, c.full_name)) key
      from contacts c where c.anonymized_at is null
  )
  select k1.id, k2.id, array_agg(distinct left(k1.key, 1) order by left(k1.key, 1))
    from k k1 join k k2 on k1.key = k2.key and k1.id < k2.id
   where not exists (select 1 from contact_duplicate_dismissals d where d.a = k1.id and d.b = k2.id)
   group by k1.id, k2.id
   order by count(*) desc, k1.id
   limit greatest(1, least(p_limit, 1000));
$$;

-- Ενοποίηση: όλα του p_drop πάνε στο p_keep, τα κενά πεδία συμπληρώνονται,
-- tags/ομάδες ενώνονται, και το p_drop διαγράφεται (στιγμιότυπο στο contact_merges).
create or replace function public.merge_contacts(p_keep uuid, p_drop uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  k contacts; d contacts;
  fk record; r record;
  v_moved int := 0; v_n int; v_removed jsonb := '[]'::jsonb;
begin
  if coalesce(current_app_role()::text, '') not in ('admin', 'management', 'sales') then
    raise exception 'Δεν έχετε δικαίωμα ενοποίησης επαφών.';
  end if;
  if p_keep is null or p_drop is null or p_keep = p_drop then raise exception 'Διαλέξτε δύο διαφορετικές επαφές.'; end if;
  select * into k from contacts where id = p_keep for update;
  select * into d from contacts where id = p_drop for update;
  if k.id is null or d.id is null then raise exception 'Η επαφή δεν βρέθηκε.'; end if;
  if k.anonymized_at is not null or d.anonymized_at is not null then raise exception 'Μία από τις επαφές έχει ανωνυμοποιηθεί (GDPR).'; end if;
  if exists (select 1 from profiles where contact_id = p_keep) and exists (select 1 from profiles where contact_id = p_drop) then
    raise exception 'Και οι δύο επαφές έχουν λογαριασμό στο portal — δεν ενοποιούνται αυτόματα.';
  end if;

  -- Όλα τα foreign keys προς contacts, χωρίς λίστα με το χέρι.
  for fk in
    select c.conrelid::regclass::text tbl, a.attname col
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.confrelid = 'public.contacts'::regclass and c.contype = 'f' and array_length(c.conkey, 1) = 1
  loop
    begin
      execute format('update %s set %I = $1 where %I = $2', fk.tbl, fk.col, fk.col) using p_keep, p_drop;
      get diagnostics v_n = row_count; v_moved := v_moved + v_n;
    exception when unique_violation then
      -- π.χ. KYC: κρατάμε της επαφής που μένει, φυλάμε το άλλο στο στιγμιότυπο.
      for r in execute format('select ctid, to_jsonb(t) j from %s t where %I = $1', fk.tbl, fk.col) using p_drop loop
        begin
          execute format('update %s set %I = $1 where ctid = $2', fk.tbl, fk.col) using p_keep, r.ctid;
          v_moved := v_moved + 1;
        exception when unique_violation then
          v_removed := v_removed || jsonb_build_object('table', fk.tbl, 'row', r.j);
          execute format('delete from %s where ctid = $1', fk.tbl) using r.ctid;
        end;
      end loop;
    end;
  end loop;
  delete from contact_relations where contact_id = p_keep and related_contact_id = p_keep;

  update documents set entity_id = p_keep where entity_type = 'contact' and entity_id = p_drop;
  update notes set entity_id = p_keep where entity_type = 'contact' and entity_id = p_drop;
  update activity_log set entity_id = p_keep where entity_type = 'contact' and entity_id = p_drop;
  delete from contact_duplicate_dismissals where a = p_drop or b = p_drop;

  insert into contact_merges (kept_id, dropped_id, dropped_snapshot, merged_by)
  values (p_keep, p_drop, jsonb_build_object('contact', to_jsonb(d), 'removed_rows', v_removed), auth.uid());

  delete from contacts where id = p_drop; -- πρώτα, για το unique email

  update contacts set
    email = coalesce(k.email, d.email),
    phone = coalesce(k.phone, d.phone),
    nationality = coalesce(k.nationality, d.nationality),
    preferred_language = coalesce(k.preferred_language, d.preferred_language),
    buyer_type = coalesce(k.buyer_type, d.buyer_type),
    communication_preference = coalesce(k.communication_preference, d.communication_preference),
    nurture_style = coalesce(k.nurture_style, d.nurture_style),
    best_time = coalesce(k.best_time, d.best_time),
    best_time_note = coalesce(k.best_time_note, d.best_time_note),
    first_touch_source = case when d.created_at < k.created_at then coalesce(d.first_touch_source, k.first_touch_source) else coalesce(k.first_touch_source, d.first_touch_source) end,
    consent_at = coalesce(k.consent_at, d.consent_at),
    consent_source = case when k.consent_at is null then d.consent_source else k.consent_source end,
    consent_text = case when k.consent_at is null then d.consent_text else k.consent_text end,
    marketing_opt_in = case when k.marketing_opt_in_at is null and d.marketing_opt_in_at is not null then d.marketing_opt_in else k.marketing_opt_in end,
    marketing_opt_in_at = coalesce(k.marketing_opt_in_at, d.marketing_opt_in_at),
    is_lead = coalesce(k.is_lead, false) or coalesce(d.is_lead, false),
    is_buyer = coalesce(k.is_buyer, false) or coalesce(d.is_buyer, false),
    is_investor = coalesce(k.is_investor, false) or coalesce(d.is_investor, false),
    is_homeowner = coalesce(k.is_homeowner, false) or coalesce(d.is_homeowner, false),
    is_newsletter_subscriber = coalesce(k.is_newsletter_subscriber, false) or coalesce(d.is_newsletter_subscriber, false),
    tags = coalesce((select array_agg(distinct x) from unnest(coalesce(k.tags, '{}') || coalesce(d.tags, '{}')) x), '{}'),
    groups = coalesce((select array_agg(distinct x) from unnest(coalesce(k.groups, '{}') || coalesce(d.groups, '{}')) x), '{}'),
    custom_fields = coalesce(d.custom_fields, '{}'::jsonb) || coalesce(k.custom_fields, '{}'::jsonb),
    created_at = least(k.created_at, d.created_at),
    updated_at = now()
  where id = p_keep;

  insert into activity_log (entity_type, entity_id, action, actor_id, metadata)
  values ('contact', p_keep, 'contacts_merged', auth.uid(),
          jsonb_build_object('dropped_id', p_drop, 'dropped_name', d.full_name, 'moved_rows', v_moved));

  return jsonb_build_object('kept', p_keep, 'moved', v_moved, 'removed', jsonb_array_length(v_removed));
end $$;
revoke all on function public.merge_contacts(uuid, uuid) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;
grant execute on function public.find_duplicate_contacts(uuid) to authenticated;
grant execute on function public.duplicate_contact_pairs(int) to authenticated;

-- ── Καλωσόρισμα στη γλώσσα του πελάτη: email σε ελληνικά & ρωσικά ──────────
insert into message_templates (channel, key, name, subject, body, is_active, audience)
select 'email', 'first_contact', 'First contact (EL)', 'Καλώς ήρθατε — {{project}}',
       E'Γεια σας {{name}},\n\nΕυχαριστούμε για το ενδιαφέρον σας για το {{project}}. Είμαι ο/η {{agent}} και θα σας βοηθήσω προσωπικά.\n\nΠότε σας βολεύει να μιλήσουμε;\n\nΜε εκτίμηση,\n{{agent}}', true, 'el'
where not exists (select 1 from message_templates where channel = 'email' and key = 'first_contact' and audience = 'el');
insert into message_templates (channel, key, name, subject, body, is_active, audience)
select 'email', 'first_contact', 'First contact (RU)', 'Добро пожаловать — {{project}}',
       E'Здравствуйте, {{name}}!\n\nСпасибо за интерес к {{project}}. Меня зовут {{agent}}, я лично помогу вам с выбором.\n\nКогда вам удобно поговорить?\n\nС уважением,\n{{agent}}', true, 'ru'
where not exists (select 1 from message_templates where channel = 'email' and key = 'first_contact' and audience = 'ru');

-- ── GDPR: τα στιγμιότυπα ενοποίησης φεύγουν μαζί με την επαφή ──────────────
create or replace function public.gdpr_cleanup_contact_extras()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  delete from public.contact_relations where contact_id = new.contact_id;
  update public.contact_relations set related_contact_id = null, related_name = 'Διαγραμμένη επαφή', related_phone = null, related_email = null
   where related_contact_id = new.contact_id;
  delete from public.contact_kyc where contact_id = new.contact_id;
  update public.contacts set best_time = null, best_time_note = null, preferred_language = null where id = new.contact_id;
  delete from public.contact_merges where kept_id = new.contact_id;
  delete from public.contact_duplicate_dismissals where a = new.contact_id or b = new.contact_id;
  return new;
end;
$function$;
