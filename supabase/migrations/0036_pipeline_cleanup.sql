-- Oramira OS — Migration 0036: clean sales pipeline
-- The pipeline (lead.status) is the single source of truth. New leads start at
-- 'new' and stay there until manually moved. Follow-ups are a TASK layer, not a
-- stage — so a new lead must NOT auto-create a follow-up task, and leads must
-- NOT be auto-assigned on creation.

-- on_lead_created: keep the activity log + notify, drop the auto follow-up task.
create or replace function on_lead_created() returns trigger as $$
begin
  insert into activity_log (entity_type, entity_id, action, metadata)
  values ('lead', NEW.id, 'created', jsonb_build_object('source', NEW.source));

  perform pg_notify('lead_created', NEW.id::text);
  return NEW;
end;
$$ language plpgsql;

-- set_default_lead_owner: no auto-assignment. Only stamp assigned_at when an
-- owner is explicitly provided. Leads are left unassigned until assigned manually.
create or replace function set_default_lead_owner() returns trigger as $$
begin
  if NEW.assigned_to is not null and NEW.assigned_at is null then
    NEW.assigned_at := now();
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Clear the legacy auto-created "initial follow-up" tasks that were polluting
-- the Follow-ups view for brand-new leads (one-time cleanup).
delete from follow_up_tasks where note = 'Initial follow-up — new lead' and is_done = false;
