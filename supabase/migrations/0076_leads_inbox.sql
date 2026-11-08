-- Leads Inbox (όπως Pipedrive): ό,τι έρχεται από έξω (φόρμες, Meta, WhatsApp,
-- κράτηση προβολής) μπαίνει πρώτα στο Inbox· όταν το «μετατρέψετε σε deal»
-- εμφανίζεται στο pipeline. Ό,τι καταχωρεί το προσωπικό πάει κατευθείαν στο
-- pipeline. Ρύθμιση: org_settings.data.pipelines.inboxFirst (προεπιλογή ναι).
create or replace function public.leads_inbox_default() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null and coalesce((select (data->'pipelines'->>'inboxFirst')::boolean from public.org_settings where id = 'org'), true) then
    new.in_inbox := true;
  end if;
  return new;
end $$;
drop trigger if exists leads_inbox_default on public.leads;
create trigger leads_inbox_default before insert on public.leads
  for each row execute function public.leads_inbox_default();
