-- Oramira OS — Migration 0020: smart lead assignment + next action
-- Additive (don't edit earlier migrations). Adds assignment metadata, a
-- next-action the priority board groups on, an assignment-history table, and a
-- default-owner rule so no inbound lead is ever left ownerless.

-- Default lead owner (org-level). Used by the assignment trigger below.
alter table organizations add column default_lead_owner_id uuid references profiles(id);

-- Lead assignment + next-action fields.
alter table leads add column assigned_by uuid references profiles(id);
alter table leads add column assigned_at timestamptz;
alter table leads add column next_action_date date;
alter table leads add column next_action_type text; -- call | whatsapp | email | follow_up | viewing

-- Assignment history (every assignment / reassignment is recorded).
create table lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  assigned_to uuid references profiles(id),
  assigned_by uuid references profiles(id),
  note text,
  created_at timestamptz default now()
);
create index idx_lead_assignments_lead on lead_assignments (lead_id, created_at desc);
alter table lead_assignments enable row level security;
create policy lead_assignments_staff_all on lead_assignments for all using (is_staff()) with check (is_staff());

-- Default owner on insert: if no one is assigned, route to the org's default
-- owner, falling back to the earliest admin ("assign to me by default"). Stamps
-- assigned_at when an owner is present.
create or replace function set_default_lead_owner() returns trigger as $$
begin
  if NEW.assigned_to is null then
    NEW.assigned_to := coalesce(
      (select default_lead_owner_id from organizations order by created_at limit 1),
      (select id from profiles where role = 'admin' order by created_at limit 1)
    );
  end if;
  if NEW.assigned_to is not null and NEW.assigned_at is null then
    NEW.assigned_at := now();
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_default_lead_owner before insert on leads
  for each row execute function set_default_lead_owner();

-- Record the initial assignment in history.
create or replace function log_initial_lead_assignment() returns trigger as $$
begin
  if NEW.assigned_to is not null then
    insert into lead_assignments (lead_id, assigned_to, assigned_by, note)
    values (NEW.id, NEW.assigned_to, NEW.assigned_by, 'Initial assignment');
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_log_initial_lead_assignment after insert on leads
  for each row execute function log_initial_lead_assignment();
