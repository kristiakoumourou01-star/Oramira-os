-- 0073 · Διαγραφή lead με λόγο. Το lead δεν σβήνεται οριστικά: κρύβεται από
-- όλες τις λίστες (RLS), κλείνει (status lost) ώστε να μη το πιάνουν οι
-- αυτοματισμοί, και κρατά ποιος/πότε/γιατί για έλεγχο ή επαναφορά.
alter table public.leads add column if not exists deleted_at timestamptz;
alter table public.leads add column if not exists deleted_by uuid references public.profiles(id);
alter table public.leads add column if not exists deleted_reason text;
create index if not exists leads_deleted_at_idx on public.leads (deleted_at) where deleted_at is not null;

drop policy if exists leads_hide_deleted on public.leads;
create policy leads_hide_deleted on public.leads as restrictive for select using (deleted_at is null);

create or replace function public.soft_delete_lead(p_lead uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'reason required'; end if;
  update leads set deleted_at = now(), deleted_by = auth.uid(), deleted_reason = left(btrim(p_reason), 500),
                   status = 'lost', lost_reason = coalesce(lost_reason, 'deleted')
   where id = p_lead and deleted_at is null;
  if not found then raise exception 'lead not found'; end if;
  update follow_up_tasks set is_done = true where lead_id = p_lead and is_done = false;
end $$;

create or replace function public.restore_lead(p_lead uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  update leads set deleted_at = null, deleted_by = null, deleted_reason = null where id = p_lead;
end $$;

revoke all on function public.soft_delete_lead(uuid, text) from public, anon;
revoke all on function public.restore_lead(uuid) from public, anon;
grant execute on function public.soft_delete_lead(uuid, text) to authenticated;
grant execute on function public.restore_lead(uuid) to authenticated;
