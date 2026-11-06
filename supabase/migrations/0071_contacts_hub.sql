-- 0071 · Επαφές: καταχώριση από το προσωπικό, ιδιότητες, κατάσταση, υπεύθυνος,
-- μετατροπές (lead → αγοραστής → επενδυτής …) και πλήρες ιστορικό ανά επαφή.

-- Επαφή χωρίς email (π.χ. walk-in με μόνο τηλέφωνο). Το unique μένει: πολλά NULL επιτρέπονται.
alter table public.contacts alter column email drop not null;

alter table public.contacts add column if not exists status text not null default 'active';
alter table public.contacts drop constraint if exists contacts_status_check;
alter table public.contacts add constraint contacts_status_check
  check (status in ('active', 'inactive', 'do_not_contact', 'archived'));
alter table public.contacts add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.contacts add column if not exists extra_roles text[] not null default '{}';
create index if not exists contacts_owner_idx on public.contacts (owner_id);
create index if not exists contacts_status_idx on public.contacts (status);

-- ── Ιστορικό επαφής ─────────────────────────────────────────────────────────
create table if not exists public.contact_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  kind text not null,            -- created | role_added | role_removed | status | owner | converted | note
  from_value text,
  to_value text,
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contact_events_contact_idx on public.contact_events (contact_id, created_at desc);
alter table public.contact_events enable row level security;
drop policy if exists contact_events_staff_read on public.contact_events;
create policy contact_events_staff_read on public.contact_events for select using (is_staff());
drop policy if exists contact_events_staff_insert on public.contact_events;
create policy contact_events_staff_insert on public.contact_events for insert with check (is_staff());

-- Κάθε αλλαγή καταγράφεται αυτόματα, όποια οθόνη κι αν την κάνει.
create or replace function public.contact_log_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  r text;
begin
  if not exists (select 1 from profiles where id = v_actor) then v_actor := null; end if;
  if tg_op = 'INSERT' then
    insert into contact_events (contact_id, kind, to_value, actor_id)
    values (new.id, 'created', coalesce(new.first_touch_source::text, 'manual'), v_actor);
    if new.is_lead then insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, 'role_added', 'lead', v_actor); end if;
    if new.is_buyer then insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, 'role_added', 'buyer', v_actor); end if;
    if new.is_investor then insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, 'role_added', 'investor', v_actor); end if;
    if new.is_homeowner then insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, 'role_added', 'homeowner', v_actor); end if;
    foreach r in array coalesce(new.extra_roles, '{}') loop
      insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, 'role_added', r, v_actor);
    end loop;
    return new;
  end if;

  if new.anonymized_at is not null then return new; end if; -- GDPR: δεν καταγράφουμε την ανωνυμοποίηση ως αλλαγές

  if coalesce(old.is_lead, false) <> coalesce(new.is_lead, false) then
    insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, case when new.is_lead then 'role_added' else 'role_removed' end, 'lead', v_actor); end if;
  if coalesce(old.is_buyer, false) <> coalesce(new.is_buyer, false) then
    insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, case when new.is_buyer then 'role_added' else 'role_removed' end, 'buyer', v_actor); end if;
  if coalesce(old.is_investor, false) <> coalesce(new.is_investor, false) then
    insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, case when new.is_investor then 'role_added' else 'role_removed' end, 'investor', v_actor); end if;
  if coalesce(old.is_homeowner, false) <> coalesce(new.is_homeowner, false) then
    insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, case when new.is_homeowner then 'role_added' else 'role_removed' end, 'homeowner', v_actor); end if;
  if coalesce(old.is_newsletter_subscriber, false) <> coalesce(new.is_newsletter_subscriber, false) then
    insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, case when new.is_newsletter_subscriber then 'role_added' else 'role_removed' end, 'newsletter', v_actor); end if;
  for r in select unnest(coalesce(new.extra_roles, '{}')) except select unnest(coalesce(old.extra_roles, '{}')) loop
    insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, 'role_added', r, v_actor);
  end loop;
  for r in select unnest(coalesce(old.extra_roles, '{}')) except select unnest(coalesce(new.extra_roles, '{}')) loop
    insert into contact_events (contact_id, kind, to_value, actor_id) values (new.id, 'role_removed', r, v_actor);
  end loop;
  if old.status is distinct from new.status then
    insert into contact_events (contact_id, kind, from_value, to_value, actor_id) values (new.id, 'status', old.status, new.status, v_actor); end if;
  if old.owner_id is distinct from new.owner_id then
    insert into contact_events (contact_id, kind, from_value, to_value, actor_id) values (new.id, 'owner', old.owner_id::text, new.owner_id::text, v_actor); end if;

  -- Ιδιότητα → εγγραφή στον αντίστοιχο πίνακα (portal αγοραστή, επενδυτές).
  if new.is_buyer and not coalesce(old.is_buyer, false) and not exists (select 1 from buyers where contact_id = new.id) then
    insert into buyers (contact_id) values (new.id);
  end if;
  if new.is_investor and not coalesce(old.is_investor, false) and not exists (select 1 from investors where contact_id = new.id) then
    insert into investors (contact_id) values (new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_contact_log on public.contacts;
create trigger trg_contact_log after insert or update on public.contacts
  for each row execute function public.contact_log_changes();

-- Ίδιο και για νέα επαφή που γίνεται αγοραστής/επενδυτής κατά τη δημιουργία.
create or replace function public.contact_role_rows()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_buyer and not exists (select 1 from buyers where contact_id = new.id) then insert into buyers (contact_id) values (new.id); end if;
  if new.is_investor and not exists (select 1 from investors where contact_id = new.id) then insert into investors (contact_id) values (new.id); end if;
  return new;
end $$;
drop trigger if exists trg_contact_role_rows on public.contacts;
create trigger trg_contact_role_rows after insert on public.contacts
  for each row execute function public.contact_role_rows();

-- ── Λίστα επαφών: τελευταία επαφή, ανοιχτά leads, υπεύθυνος ─────────────────
create or replace view public.contact_overview with (security_invoker = true) as
select
  c.id,
  greatest(
    (select max(cc.occurred_at) from contact_communications cc where cc.contact_id = c.id),
    (select max(l.last_contacted_at) from leads l where l.contact_id = c.id)
  ) as last_contact_at,
  (select count(*) from leads l where l.contact_id = c.id and l.status::text not in ('won', 'lost', 'nurture', 'no_response', 'retargeting')) as open_leads,
  coalesce(c.owner_id, (select l.assigned_to from leads l where l.contact_id = c.id and l.assigned_to is not null order by l.created_at desc limit 1)) as effective_owner,
  (select k.status from contact_kyc k where k.contact_id = c.id) as kyc_status
from contacts c;
grant select on public.contact_overview to authenticated;
