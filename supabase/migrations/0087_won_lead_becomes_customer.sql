-- Pipeline: όταν ένα lead γίνει «Κερδήθηκε» (won), ο πελάτης του εμφανίζεται
-- αυτόματα στους Πελάτες (contacts.is_buyer = true). Additive, idempotent.
create or replace function public.mark_won_lead_customer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'won' and new.contact_id is not null
     and (tg_op = 'INSERT' or old.status::text is distinct from 'won') then
    update public.contacts set is_buyer = true, updated_at = now()
     where id = new.contact_id and coalesce(is_buyer, false) = false;
  end if;
  return new;
end $$;

drop trigger if exists trg_won_lead_customer on public.leads;
create trigger trg_won_lead_customer
  after insert or update of status on public.leads
  for each row execute function public.mark_won_lead_customer();

-- Όσα έχουν ήδη κερδηθεί.
update public.contacts c set is_buyer = true
  where coalesce(c.is_buyer, false) = false
    and exists (select 1 from public.leads l where l.contact_id = c.id and l.status::text = 'won');
