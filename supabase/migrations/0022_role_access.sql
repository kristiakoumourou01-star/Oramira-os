-- Oramira OS — Migration 0022: role-based data access
-- Additive (don't edit earlier migrations).
--
-- Two changes:
-- 1. is_staff() now recognises ALL internal roles, so Finance / Construction /
--    Viewer can read the operational data their modules need. Module-level and
--    read-only restrictions for these roles are enforced in the application
--    layer (lib/permissions.ts + page guards). Tightening these to per-table
--    RLS is the next hardening step.
-- 2. Lead ownership is enforced at the DB: a Sales Agent sees ONLY their own
--    assigned leads, while Admin/Manager see all and Viewer reads all. This is
--    the security-critical rule for a multi-agent sales team.

create or replace function is_staff() returns boolean as $$
  select current_role() in ('admin', 'sales', 'management', 'finance', 'construction', 'viewer');
$$ language sql stable security definer;

-- ── Lead ownership ───────────────────────────────────────────────────────────
-- Replace the blanket staff policy with role-aware policies.
drop policy if exists leads_staff_all on leads;

create policy leads_managers_all on leads for all
  using (current_role() in ('admin', 'management'))
  with check (current_role() in ('admin', 'management'));

create policy leads_sales_own on leads for all
  using (current_role() = 'sales' and assigned_to = auth.uid())
  with check (current_role() = 'sales' and assigned_to = auth.uid());

create policy leads_viewer_read on leads for select
  using (current_role() = 'viewer');

-- Assignment history follows the same managers/own pattern so an agent only
-- sees history for leads they can see.
drop policy if exists lead_assignments_staff_all on lead_assignments;
create policy lead_assignments_managers_all on lead_assignments for all
  using (current_role() in ('admin', 'management')) with check (current_role() in ('admin', 'management'));
create policy lead_assignments_sales_read on lead_assignments for select
  using (current_role() = 'sales' and exists (select 1 from leads l where l.id = lead_assignments.lead_id and l.assigned_to = auth.uid()));
