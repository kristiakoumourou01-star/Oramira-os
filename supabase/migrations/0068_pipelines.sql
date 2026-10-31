-- Oramira OS — Migration 0068: pipelines (βήμα 13)
-- Πολλαπλά pipelines (ρύθμιση), χρόνος σε κάθε στάδιο, λόγος απώλειας,
-- επιστρέφων πελάτης, σύνδεση με τιμολόγιο προμήθειας. Additive.

alter table leads add column if not exists pipeline text;                         -- κλειδί από Ρυθμίσεις → Pipelines (null = το προεπιλεγμένο)
alter table leads add column if not exists stage_entered_at timestamptz;
alter table leads add column if not exists lost_reason text;                      -- κλειδί από Ρυθμίσεις → λόγοι απώλειας
alter table leads add column if not exists lost_note text;
alter table leads add column if not exists is_returning boolean not null default false;
alter table leads add column if not exists commission_invoice_id uuid references invoices(id) on delete set null;
update leads set stage_entered_at = coalesce(updated_at, created_at) where stage_entered_at is null;
alter table leads alter column stage_entered_at set default now();

-- Ιστορικό σταδίων: για τον μέσο χρόνο ανά στάδιο και τις καθυστερήσεις.
create table if not exists lead_stage_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  from_status text,
  to_status text not null,
  days_in_prev numeric,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists lead_stage_events_lead_idx on lead_stage_events (lead_id, changed_at);
create index if not exists lead_stage_events_at_idx on lead_stage_events (changed_at desc);
alter table lead_stage_events enable row level security;
drop policy if exists lead_stage_events_staff_read on lead_stage_events;
create policy lead_stage_events_staff_read on lead_stage_events for select using (is_staff());

create or replace function lead_stage_change() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into lead_stage_events (lead_id, from_status, to_status, days_in_prev, changed_by)
    values (new.id, old.status::text, new.status::text,
            round((extract(epoch from (now() - coalesce(old.stage_entered_at, old.created_at))) / 86400)::numeric, 2), auth.uid());
    new.stage_entered_at := now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_lead_stage_change on leads;
create trigger trg_lead_stage_change before update of status on leads
  for each row execute function lead_stage_change();

-- Επιστρέφων πελάτης: έχει ήδη κλείσει αγορά (won lead, μονάδα ή ιδιοκτησία).
-- Ένα νέο lead του χωρίς υπεύθυνο πάει στον πωλητή της τελευταίας αγοράς.
-- (Το όνομα ξεκινά με «trg_a_» ώστε να τρέχει πριν από το trg_default_lead_owner.)
create or replace function lead_mark_returning() returns trigger as $$
declare v_prev uuid;
begin
  if new.contact_id is null then return new; end if;
  if exists (select 1 from leads l where l.contact_id = new.contact_id and l.status::text = 'won' and l.id <> new.id)
     or exists (select 1 from units u where u.buyer_contact_id = new.contact_id)
     or exists (select 1 from homeowners h where h.contact_id = new.contact_id) then
    new.is_returning := true;
    if new.assigned_to is null then
      select l.assigned_to into v_prev from leads l
       where l.contact_id = new.contact_id and l.status::text = 'won' and l.assigned_to is not null
       order by l.updated_at desc nulls last limit 1;
      if v_prev is not null and exists (select 1 from profiles p where p.id = v_prev) then new.assigned_to := v_prev; end if;
    end if;
  end if;
  new.stage_entered_at := coalesce(new.stage_entered_at, now());
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_a_lead_returning on leads;
create trigger trg_a_lead_returning before insert on leads
  for each row execute function lead_mark_returning();

-- Υπάρχοντα leads: σημείωση επιστρεφόντων.
update leads l set is_returning = true
 where not l.is_returning and (
   exists (select 1 from leads o where o.contact_id = l.contact_id and o.status::text = 'won' and o.id <> l.id and o.created_at < l.created_at)
 );

notify pgrst, 'reload schema';
