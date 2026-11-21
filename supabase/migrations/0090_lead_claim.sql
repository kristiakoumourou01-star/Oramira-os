-- Νέα leads (Διαχείριση leads → Νέα leads): όλα τα εισερχόμενα χωρίς υπεύθυνο.
-- Ένας Sales Agent βλέπει τα leads χωρίς υπεύθυνο και μπορεί να τα αναλάβει
-- («Ανάληψη»): μόνο από «χωρίς υπεύθυνο» → «εγώ». Δεν μπορεί να τα δώσει σε άλλον
-- (αυτό το κάνει Admin / Manager). Additive + idempotent.

-- Ο agent βλέπει τα leads χωρίς υπεύθυνο (εκτός από τα δικά του, policy leads_sales_own).
drop policy if exists leads_sales_unassigned_read on public.leads;
create policy leads_sales_unassigned_read on public.leads for select
  using (current_app_role()::text = 'sales' and assigned_to is null);

-- Ανάληψη: γραμμή χωρίς υπεύθυνο → υπεύθυνος ο ίδιος ο agent.
drop policy if exists leads_sales_claim on public.leads;
create policy leads_sales_claim on public.leads for update
  using (current_app_role()::text = 'sales' and assigned_to is null)
  with check (current_app_role()::text = 'sales' and assigned_to = auth.uid());

-- Ιστορικό ανάθεσης: ο agent καταγράφει τη δική του ανάληψη.
drop policy if exists lead_assignments_sales_claim on public.lead_assignments;
create policy lead_assignments_sales_claim on public.lead_assignments for insert
  with check (current_app_role()::text = 'sales' and assigned_to = auth.uid() and assigned_by = auth.uid());

-- Γρήγορη λίστα «Νέα leads».
create index if not exists idx_leads_unassigned on public.leads (created_at desc) where assigned_to is null;
