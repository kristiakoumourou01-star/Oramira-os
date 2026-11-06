-- 0072 · Δικά σας στάδια στα pipelines: κάθε στάδιο έχει κλειδί και «σημαίνει» μία
-- από τις καταστάσεις του συστήματος. Το lead κρατά το στάδιο στο leads.stage.
alter table public.leads add column if not exists stage text;
alter table public.lead_stage_events add column if not exists from_stage text;
alter table public.lead_stage_events add column if not exists to_stage text;

create or replace function public.lead_stage_change()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if tg_op = 'UPDATE' and (new.status is distinct from old.status or new.stage is distinct from old.stage) then
    insert into lead_stage_events (lead_id, from_status, to_status, from_stage, to_stage, days_in_prev, changed_by)
    values (new.id, old.status::text, new.status::text, old.stage, new.stage,
            round((extract(epoch from (now() - coalesce(old.stage_entered_at, old.created_at))) / 86400)::numeric, 2), auth.uid());
    new.stage_entered_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_lead_stage_change on public.leads;
create trigger trg_lead_stage_change before update of status, stage on public.leads
  for each row execute function public.lead_stage_change();
