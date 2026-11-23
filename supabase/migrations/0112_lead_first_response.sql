-- Πρώτη επαφή με lead: όταν γράφεται για πρώτη φορά «τελευταία επαφή», κρατιέται
-- και ως «πρώτη απάντηση» (για τον μέσο χρόνο απάντησης ανά συνεργάτη).
create or replace function public.leads_set_first_response()
returns trigger language plpgsql as $$
begin
  if new.first_response_at is null and new.last_contacted_at is not null
     and (tg_op = 'INSERT' or old.last_contacted_at is distinct from new.last_contacted_at) then
    new.first_response_at := new.last_contacted_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_first_response on public.leads;
create trigger trg_leads_first_response
  before insert or update of last_contacted_at on public.leads
  for each row execute function public.leads_set_first_response();

-- Παλιά leads: η καλύτερη διαθέσιμη εκτίμηση είναι η πρώτη καταγεγραμμένη επαφή.
update public.leads
   set first_response_at = last_contacted_at
 where first_response_at is null and last_contacted_at is not null and last_contacted_at >= created_at;
