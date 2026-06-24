-- Oramira OS — Migration 0007: Row Level Security
-- Deny-by-default on every table. See Phase 3 doc for the full reasoning;
-- this file is the literal, runnable version of those policies.

alter table contacts enable row level security;
alter table profiles enable row level security;
alter table leads enable row level security;
alter table buyers enable row level security;
alter table investors enable row level security;
alter table contact_communications enable row level security;
alter table follow_up_tasks enable row level security;
alter table website_submissions enable row level security;
alter table newsletter_subscribers enable row level security;
alter table deals enable row level security;
alter table deal_scenarios enable row level security;
alter table projects enable row level security;
alter table buildings enable row level security;
alter table project_phases enable row level security;
alter table units enable row level security;
alter table project_milestones enable row level security;
alter table reservations enable row level security;
alter table contracts enable row level security;
alter table payment_schedules enable row level security;
alter table payments enable row level security;
alter table homeowners enable row level security;
alter table maintenance_tickets enable row level security;
alter table ticket_photos enable row level security;
alter table ticket_updates enable row level security;
alter table warranties enable row level security;
alter table contractors enable row level security;
alter table construction_tasks enable row level security;
alter table contractor_performance_notes enable row level security;
alter table contractor_invoices enable row level security;
alter table contractor_project_assignments enable row level security;
alter table project_team_contacts enable row level security;
alter table investor_holdings enable row level security;
alter table investor_projections enable row level security;
alter table documents enable row level security;
alter table notes enable row level security;
alter table activity_log enable row level security;
alter table tasks enable row level security;
alter table notifications enable row level security;
alter table notification_events enable row level security;
alter table messages enable row level security;
alter table invites enable row level security;

-- Identity
create policy contacts_staff_all on contacts for all using (is_staff()) with check (is_staff());
create policy profiles_self_read on profiles for select using (id = auth.uid());
create policy profiles_staff_all on profiles for all using (is_staff()) with check (is_staff());

-- CRM — staff only, no external role ever reads these directly
create policy leads_staff_all on leads for all using (is_staff()) with check (is_staff());
create policy buyers_staff_all on buyers for all using (is_staff()) with check (is_staff());
create policy buyers_self_read on buyers for select using (contact_id = current_contact_id());
create policy investors_staff_all on investors for all using (is_staff()) with check (is_staff());
create policy comms_staff_all on contact_communications for all using (is_staff()) with check (is_staff());
create policy followups_staff_all on follow_up_tasks for all using (is_staff()) with check (is_staff());
create policy website_submissions_staff_all on website_submissions for all using (is_staff()) with check (is_staff());
create policy newsletter_staff_all on newsletter_subscribers for all using (is_staff()) with check (is_staff());

-- Deal Analyzer
create policy deals_staff_all on deals for all using (is_staff()) with check (is_staff());
create policy deal_scenarios_staff_all on deal_scenarios for all using (is_staff()) with check (is_staff());

-- Projects / units / milestones
create policy projects_staff_all on projects for all using (is_staff()) with check (is_staff());
create policy projects_external_read on projects for select using (
  exists (select 1 from units u where u.project_id = projects.id and (owns_unit_as_buyer(u.id) or owns_unit_as_homeowner(u.id)))
  or investor_holds_project(projects.id) or contractor_assigned_to_project(projects.id)
);

create policy buildings_staff_all on buildings for all using (is_staff()) with check (is_staff());
create policy buildings_external_read on buildings for select using (
  exists (select 1 from units u where u.building_id = buildings.id and (owns_unit_as_buyer(u.id) or owns_unit_as_homeowner(u.id)))
  or investor_holds_project(buildings.project_id) or contractor_assigned_to_project(buildings.project_id)
);

create policy phases_staff_all on project_phases for all using (is_staff()) with check (is_staff());
create policy phases_external_read on project_phases for select using (
  exists (select 1 from units u where u.phase_id = project_phases.id and (owns_unit_as_buyer(u.id) or owns_unit_as_homeowner(u.id)))
  or investor_holds_project(project_phases.project_id) or contractor_assigned_to_project(project_phases.project_id)
);

create policy units_staff_all on units for all using (is_staff()) with check (is_staff());
create policy units_buyer_read on units for select using (owns_unit_as_buyer(id));
create policy units_homeowner_read on units for select using (owns_unit_as_homeowner(id));
create policy units_investor_read on units for select using (investor_holds_unit(id));
create policy units_contractor_read on units for select using (contractor_assigned_to_project(project_id));

create policy milestones_staff_all on project_milestones for all using (is_staff()) with check (is_staff());
create policy milestones_external_read on project_milestones for select using (
  exists (select 1 from units u where u.project_id = project_milestones.project_id and (owns_unit_as_buyer(u.id) or owns_unit_as_homeowner(u.id)))
  or investor_holds_project(project_milestones.project_id) or contractor_assigned_to_project(project_milestones.project_id)
);

-- Sales pipeline
create policy reservations_staff_all on reservations for all using (is_staff()) with check (is_staff());
create policy reservations_buyer_read on reservations for select using (buyer_contact_id = current_contact_id());

create policy contracts_staff_all on contracts for all using (is_staff()) with check (is_staff());
create policy contracts_buyer_read on contracts for select using (buyer_contact_id = current_contact_id());

create policy payment_schedules_staff_all on payment_schedules for all using (is_staff()) with check (is_staff());
create policy payment_schedules_buyer_read on payment_schedules for select using (
  exists (select 1 from contracts c where c.id = payment_schedules.contract_id and c.buyer_contact_id = current_contact_id())
);

create policy payments_staff_all on payments for all using (is_staff()) with check (is_staff());
create policy payments_buyer_read on payments for select using (
  exists (select 1 from contracts c where c.id = payments.contract_id and c.buyer_contact_id = current_contact_id())
);

-- Homeowners / maintenance
create policy homeowners_staff_all on homeowners for all using (is_staff()) with check (is_staff());
create policy homeowners_self_read on homeowners for select using (contact_id = current_contact_id());

create policy tickets_staff_all on maintenance_tickets for all using (is_staff()) with check (is_staff());
create policy tickets_homeowner_all on maintenance_tickets for all using (
  exists (select 1 from homeowners h where h.id = maintenance_tickets.homeowner_id and h.contact_id = current_contact_id())
) with check (
  exists (select 1 from homeowners h where h.id = maintenance_tickets.homeowner_id and h.contact_id = current_contact_id())
);
create policy tickets_contractor_read on maintenance_tickets for select using (contractor_id = current_contractor_id());
create policy tickets_contractor_update on maintenance_tickets for update using (contractor_id = current_contractor_id())
  with check (contractor_id = current_contractor_id());

create policy ticket_photos_staff_all on ticket_photos for all using (is_staff()) with check (is_staff());
create policy ticket_photos_homeowner_all on ticket_photos for all using (
  exists (select 1 from maintenance_tickets t join homeowners h on h.id = t.homeowner_id where t.id = ticket_photos.ticket_id and h.contact_id = current_contact_id())
);
create policy ticket_photos_contractor_all on ticket_photos for all using (contractor_assigned_to_ticket(ticket_id));

create policy ticket_updates_staff_all on ticket_updates for all using (is_staff()) with check (is_staff());
create policy ticket_updates_homeowner_read on ticket_updates for select using (
  exists (select 1 from maintenance_tickets t join homeowners h on h.id = t.homeowner_id where t.id = ticket_updates.ticket_id and h.contact_id = current_contact_id())
);
create policy ticket_updates_contractor_all on ticket_updates for all using (contractor_assigned_to_ticket(ticket_id));

create policy warranties_staff_all on warranties for all using (is_staff()) with check (is_staff());
create policy warranties_homeowner_read on warranties for select using (owns_unit_as_homeowner(unit_id));
create policy warranties_buyer_read on warranties for select using (owns_unit_as_buyer(unit_id));

-- Contractors module
create policy contractors_staff_all on contractors for all using (is_staff()) with check (is_staff());
create policy contractors_self_read on contractors for select using (id = current_contractor_id());

create policy construction_tasks_staff_all on construction_tasks for all using (is_staff()) with check (is_staff());
create policy construction_tasks_contractor_read on construction_tasks for select using (contractor_id = current_contractor_id());
create policy construction_tasks_contractor_update on construction_tasks for update using (contractor_id = current_contractor_id())
  with check (contractor_id = current_contractor_id());
create policy construction_tasks_external_read on construction_tasks for select using (
  exists (select 1 from units u where u.project_id = construction_tasks.project_id and (owns_unit_as_buyer(u.id) or owns_unit_as_homeowner(u.id)))
  or investor_holds_project(construction_tasks.project_id)
);

create policy performance_staff_all on contractor_performance_notes for all using (is_staff()) with check (is_staff());
create policy performance_contractor_read on contractor_performance_notes for select using (contractor_id = current_contractor_id());

create policy invoices_staff_all on contractor_invoices for all using (is_staff()) with check (is_staff());
create policy invoices_contractor_all on contractor_invoices for all using (contractor_id = current_contractor_id())
  with check (contractor_id = current_contractor_id());

create policy assignments_staff_all on contractor_project_assignments for all using (is_staff()) with check (is_staff());
create policy assignments_contractor_read on contractor_project_assignments for select using (contractor_id = current_contractor_id());

create policy team_contacts_staff_all on project_team_contacts for all using (is_staff()) with check (is_staff());

-- Investor module
create policy holdings_staff_all on investor_holdings for all using (is_staff()) with check (is_staff());
create policy holdings_investor_read on investor_holdings for select using (
  exists (select 1 from investors i where i.id = investor_holdings.investor_id and i.contact_id = current_contact_id())
);
create policy projections_staff_all on investor_projections for all using (is_staff()) with check (is_staff());
create policy projections_investor_read on investor_projections for select using (
  exists (select 1 from investor_holdings ih join investors i on i.id = ih.investor_id where ih.id = investor_projections.holding_id and i.contact_id = current_contact_id())
);

-- Documents — polymorphic, resolved per entity_type
create policy documents_staff_all on documents for all using (is_staff()) with check (is_staff());
create policy documents_external_read on documents for select using (
  (entity_type = 'unit' and (
    exists (select 1 from units u where u.id = documents.entity_id and (owns_unit_as_buyer(u.id) or owns_unit_as_homeowner(u.id)))
    or exists (select 1 from units u where u.id = documents.entity_id and investor_holds_unit(u.id))
  ))
  or (entity_type = 'project' and (
    exists (select 1 from units u where u.project_id = documents.entity_id and (owns_unit_as_buyer(u.id) or owns_unit_as_homeowner(u.id)))
    or investor_holds_project(documents.entity_id) or contractor_assigned_to_project(documents.entity_id)
  ))
  or (entity_type = 'contract' and exists (select 1 from contracts c where c.id = documents.entity_id and c.buyer_contact_id = current_contact_id()))
  or (entity_type = 'ticket' and (
    exists (select 1 from maintenance_tickets t join homeowners h on h.id = t.homeowner_id where t.id = documents.entity_id and h.contact_id = current_contact_id())
    or contractor_assigned_to_ticket(documents.entity_id)
  ))
  or (entity_type = 'investor' and exists (select 1 from investors i where i.id = documents.entity_id and i.contact_id = current_contact_id()))
);
create policy documents_contractor_write on documents for insert with check (
  uploaded_by = auth.uid() and (
    (entity_type = 'ticket' and contractor_assigned_to_ticket(entity_id))
    or (entity_type = 'contractor' and entity_id = current_contractor_id())
  )
);
create policy documents_homeowner_write on documents for insert with check (
  uploaded_by = auth.uid() and entity_type = 'ticket' and exists (
    select 1 from maintenance_tickets t join homeowners h on h.id = t.homeowner_id where t.id = entity_id and h.contact_id = current_contact_id()
  )
);

-- Notes, activity, tasks, notifications, messages, invites
create policy notes_staff_all on notes for all using (is_staff()) with check (is_staff());
create policy activity_staff_all on activity_log for all using (is_staff()) with check (is_staff());
create policy tasks_staff_all on tasks for all using (is_staff());
create policy tasks_assignee_read on tasks for select using (assigned_to = auth.uid());

create policy notifications_self on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_events_staff_all on notification_events for all using (is_staff()) with check (is_staff());
create policy invites_staff_all on invites for all using (is_staff()) with check (is_staff());

create policy messages_staff_all on messages for all using (is_staff()) with check (is_staff());
create policy messages_homeowner_rw on messages for all using (
  entity_type = 'ticket' and exists (select 1 from maintenance_tickets t join homeowners h on h.id = t.homeowner_id where t.id = entity_id and h.contact_id = current_contact_id())
) with check (
  sender_id = auth.uid() and entity_type = 'ticket' and exists (select 1 from maintenance_tickets t join homeowners h on h.id = t.homeowner_id where t.id = entity_id and h.contact_id = current_contact_id())
);
create policy messages_contractor_rw on messages for all using (
  (entity_type = 'ticket' and contractor_assigned_to_ticket(entity_id)) or (entity_type = 'construction_task' and contractor_assigned_to_task(entity_id))
) with check (
  sender_id = auth.uid() and ((entity_type = 'ticket' and contractor_assigned_to_ticket(entity_id)) or (entity_type = 'construction_task' and contractor_assigned_to_task(entity_id)))
);
