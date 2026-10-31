-- Oramira OS — Migration 0063: schema-drift repair #2 (idempotent)
-- Re-applies the parts of 0020–0047 that never reached the live database
-- (viewings, negotiations, project_media, unit area/house/lifecycle columns,
-- HR tables, comms columns, calendar, acquisitions, memory...).
-- Every statement is IF NOT EXISTS / CREATE OR REPLACE / drop-then-create policy,
-- so it is safe to run more than once. Deliberate differences from the originals:
--   • current_role() → current_app_role() (the originals could not run).
--   • 0022: only is_staff(); the leads RLS split (sales see only own leads) is NOT applied.
--   • 0031: the two English 'reactivation' rows were missing the audience value.
--   • 0036: the one-off delete of old follow-up tasks is skipped (no data removed).
--   • Enum values (0021, 0026, 0031) live in 0063a, applied first.
--   • 0045 full-text index skipped (array_to_string is not IMMUTABLE, so it could never be created).
--   • 0025/0027/0030/0031/0046 message templates: only the missing RU/EL/landowner rows.
-- Applied to the live database on 31/10/2026 via the Supabase MCP.

alter table organizations add column if not exists default_lead_owner_id uuid references profiles(id);
alter table leads add column if not exists assigned_by uuid references profiles(id);
alter table leads add column if not exists assigned_at timestamptz;
alter table leads add column if not exists next_action_date date;
alter table leads add column if not exists next_action_type text;
create table if not exists lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  assigned_to uuid references profiles(id),
  assigned_by uuid references profiles(id),
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_lead_assignments_lead on lead_assignments (lead_id, created_at desc);
alter table lead_assignments enable row level security;
drop policy if exists lead_assignments_staff_all on lead_assignments;
create policy lead_assignments_staff_all on lead_assignments for all using (is_staff()) with check (is_staff());
create or replace function log_initial_lead_assignment() returns trigger as $$
begin
  if NEW.assigned_to is not null then
    insert into lead_assignments (lead_id, assigned_to, assigned_by, note)
    values (NEW.id, NEW.assigned_to, NEW.assigned_by, 'Initial assignment');
  end if;
  return NEW;
end;
$$ language plpgsql;
drop trigger if exists trg_log_initial_lead_assignment on leads;
create trigger trg_log_initial_lead_assignment after insert on leads
  for each row execute function log_initial_lead_assignment();
create or replace function is_staff() returns boolean as $$
  select current_app_role() in ('admin', 'sales', 'management', 'finance', 'construction', 'viewer');
$$ language sql stable security definer;
alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists department text;
alter table profiles add column if not exists employment_start_date date;
create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_type text not null default 'annual',
  year int not null,
  total_days numeric default 0,
  used_days numeric default 0,
  unique (profile_id, leave_type, year)
);
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_type text not null default 'annual',
  start_date date not null,
  end_date date not null,
  days numeric,
  reason text,
  status text default 'pending',
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_leave_requests_profile on leave_requests (profile_id, created_at desc);
create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  period text not null,            -- e.g. '2026-06'
  gross_amount numeric,
  net_amount numeric,
  currency text default 'EUR',
  document_id uuid references documents(id),
  status text default 'issued',
  issued_at timestamptz default now()
);
create index if not exists idx_payslips_profile on payslips (profile_id, issued_at desc);
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table payslips enable row level security;
create or replace function is_hr_manager() returns boolean as $$
  select current_app_role() in ('admin', 'management');
$$ language sql stable security definer;
drop policy if exists leave_balances_self_read on leave_balances;
create policy leave_balances_self_read on leave_balances for select using (profile_id = auth.uid());
drop policy if exists leave_balances_hr_all on leave_balances;
create policy leave_balances_hr_all on leave_balances for all using (is_hr_manager()) with check (is_hr_manager());
drop policy if exists leave_requests_self_read on leave_requests;
create policy leave_requests_self_read on leave_requests for select using (profile_id = auth.uid());
drop policy if exists leave_requests_self_insert on leave_requests;
create policy leave_requests_self_insert on leave_requests for insert with check (profile_id = auth.uid());
drop policy if exists leave_requests_hr_all on leave_requests;
create policy leave_requests_hr_all on leave_requests for all using (is_hr_manager()) with check (is_hr_manager());
drop policy if exists payslips_self_read on payslips;
create policy payslips_self_read on payslips for select using (profile_id = auth.uid());
drop policy if exists payslips_hr_all on payslips;
create policy payslips_hr_all on payslips for all using (is_hr_manager()) with check (is_hr_manager());
drop policy if exists documents_self_profile_read on documents;
create policy documents_self_profile_read on documents for select using (
  entity_type = 'profile' and entity_id = auth.uid()
);
alter table units add column if not exists occupancy_status text default 'vacant';
alter table projects add column if not exists delivery_date date;
alter table projects add column if not exists common_areas text;
alter table projects add column if not exists maintenance_schedule text;
alter table projects add column if not exists management_contact text;
alter table projects add column if not exists emergency_contact text;
create table if not exists unit_ownership_history (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  previous_contact_id uuid references contacts(id),
  new_contact_id uuid references contacts(id),
  transfer_date date default now(),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_ownership_history_unit on unit_ownership_history (unit_id, created_at desc);
alter table unit_ownership_history enable row level security;
drop policy if exists ownership_history_staff_all on unit_ownership_history;
create policy ownership_history_staff_all on unit_ownership_history for all using (is_staff()) with check (is_staff());
drop policy if exists ownership_history_owner_read on unit_ownership_history;
create policy ownership_history_owner_read on unit_ownership_history for select using (
  owns_unit_as_homeowner(unit_id) or owns_unit_as_buyer(unit_id)
);
alter table contact_communications add column if not exists lead_id uuid references leads(id);
alter table contact_communications add column if not exists body text;
alter table contact_communications add column if not exists status text default 'logged';
alter table contact_communications add column if not exists provider text;
alter table contact_communications add column if not exists provider_message_id text;
alter table contact_communications add column if not exists template_key text;
alter table contact_communications add column if not exists ai_generated boolean default false;
create index if not exists idx_comms_lead on contact_communications (lead_id, occurred_at desc);
alter table message_templates enable row level security;
drop policy if exists message_templates_staff_all on message_templates;
create policy message_templates_staff_all on message_templates for all using (is_staff()) with check (is_staff());
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  provider text not null,
  config jsonb default '{}',
  is_active boolean default false,
  created_at timestamptz default now(),
  unique (channel)
);
alter table integrations enable row level security;
drop policy if exists integrations_staff_all on integrations;
create policy integrations_staff_all on integrations for all using (is_staff()) with check (is_staff());
alter table contacts add column if not exists buyer_type text;
alter table contacts add column if not exists communication_preference text;
alter table contacts add column if not exists nurture_style text;
alter table leads add column if not exists first_response_at timestamptz;
alter table message_templates add column if not exists audience text default 'en';
alter table profiles add column if not exists work_schedule text;
alter table profiles add column if not exists agreed_salary numeric;
alter table profiles add column if not exists salary_basis text;
alter table profiles add column if not exists commission_pct numeric;
alter table profiles add column if not exists annual_leave_days numeric;
alter table profiles add column if not exists sick_leave_days numeric;
alter table invites add column if not exists onboarding jsonb default '{}';
alter table payslips add column if not exists employer_cost numeric;
alter table payslips add column if not exists total_deductions numeric;
alter table payslips add column if not exists bonus numeric default 0;
alter table payslips add column if not exists commission numeric default 0;
alter table payslips add column if not exists advances numeric default 0;
alter table payslips add column if not exists payment_date date;
alter table payslips add column if not exists breakdown jsonb default '{}';
alter table payslips add column if not exists approved_by uuid references profiles(id);
alter table payslips add column if not exists approved_at timestamptz;
create table if not exists employee_contracts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'contract',
  title text not null,
  document_id uuid references documents(id),
  status text default 'active',
  start_date date,
  expiry_date date,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_employee_contracts_profile on employee_contracts (profile_id);
alter table employee_contracts enable row level security;
drop policy if exists employee_contracts_self_read on employee_contracts;
create policy employee_contracts_self_read on employee_contracts for select using (profile_id = auth.uid());
drop policy if exists employee_contracts_hr_all on employee_contracts;
create policy employee_contracts_hr_all on employee_contracts for all using (is_hr_manager()) with check (is_hr_manager());
insert into storage.buckets (id, name, public, file_size_limit)
values ('hr-documents', 'hr-documents', false, 10485760)
on conflict (id) do nothing;
alter table payslips add column if not exists pdf_path text;
alter table employee_contracts add column if not exists probation_end_date date;
alter table employee_contracts add column if not exists renewal_date date;
create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  lead_id uuid references leads(id),
  unit_id uuid references units(id),
  reservation_id uuid references reservations(id),
  base_value numeric,
  commission_pct numeric,
  amount numeric,
  status text default 'pending',
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_commissions_profile on commissions (profile_id, created_at desc);
alter table commissions enable row level security;
drop policy if exists commissions_self_read on commissions;
create policy commissions_self_read on commissions for select using (profile_id = auth.uid());
drop policy if exists commissions_hr_all on commissions;
create policy commissions_hr_all on commissions for all using (is_hr_manager()) with check (is_hr_manager());
alter table contact_communications add column if not exists delivered_at timestamptz;
alter table contact_communications add column if not exists read_at timestamptz;
alter table contact_communications add column if not exists opened_at timestamptz;
alter table contact_communications add column if not exists clicked_at timestamptz;
alter table contact_communications add column if not exists error text;
create index if not exists idx_comms_provider_msg on contact_communications (provider_message_id);
create table if not exists viewings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  contact_id uuid not null references contacts(id) on delete cascade,
  unit_id uuid references units(id),
  project_id uuid references projects(id),
  agent_id uuid references profiles(id),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled',
  notes text,
  reminder_sent_at timestamptz,
  follow_up_sent_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_viewings_scheduled on viewings (scheduled_at);
create index if not exists idx_viewings_lead on viewings (lead_id);
alter table viewings enable row level security;
drop policy if exists viewings_staff_all on viewings;
create policy viewings_staff_all on viewings for all using (is_staff()) with check (is_staff());
create table if not exists negotiations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  unit_id uuid references units(id),
  offered_price numeric,
  counter_offer numeric,
  agreed_price numeric,
  payment_terms text,
  reservation_deposit numeric,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_negotiations_lead on negotiations (lead_id, created_at desc);
alter table negotiations enable row level security;
drop policy if exists negotiations_staff_all on negotiations;
create policy negotiations_staff_all on negotiations for all using (is_staff()) with check (is_staff());
alter table units add column if not exists internal_sqm numeric;
alter table units add column if not exists covered_veranda_sqm numeric;
alter table units add column if not exists uncovered_veranda_sqm numeric;
alter table units add column if not exists storage_sqm numeric;
alter table units add column if not exists parking_spaces integer;
create table if not exists project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  building_id uuid references buildings(id) on delete set null,
  floor integer,
  kind text not null,
  title text,
  bucket text not null default 'project-media',
  storage_path text not null,
  sort integer default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_project_media_project on project_media (project_id, kind);
create index if not exists idx_project_media_building on project_media (building_id);
alter table project_media enable row level security;
drop policy if exists project_media_staff_all on project_media;
create policy project_media_staff_all on project_media for all using (is_staff()) with check (is_staff());
drop policy if exists project_media_owner_read on project_media;
create policy project_media_owner_read on project_media for select using (
  exists (
    select 1 from units u
    where u.project_id = project_media.project_id
      and (
        u.buyer_contact_id = current_contact_id()
        or exists (select 1 from homeowners h where h.unit_id = u.id and h.contact_id = current_contact_id())
      )
  )
);
alter table projects add column if not exists development_type text default 'houses';
alter table units add column if not exists plot_size_sqm numeric;
alter table units add column if not exists garden_sqm numeric;
alter table units add column if not exists has_pool boolean default false;
alter table units add column if not exists map_x numeric;
alter table units add column if not exists map_y numeric;
alter table units add column if not exists construction_progress integer default 0;
alter table units add column if not exists utility_water text default 'not_connected';
alter table units add column if not exists utility_electricity text default 'not_connected';
alter table units add column if not exists utility_internet text default 'not_connected';
alter table units add column if not exists handover_checklist jsonb default '[]'::jsonb;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists id_passport text;
alter table profiles add column if not exists address text;
alter table profiles add column if not exists emergency_contact text;
alter table profiles add column if not exists salary_frequency text;
alter table profiles add column if not exists bonus_structure text;
alter table profiles add column if not exists special_leave_days numeric;
alter table profiles add column if not exists unpaid_leave_days numeric;
alter table profiles add column if not exists module_access jsonb default '[]'::jsonb;
alter table profiles add column if not exists benefits jsonb default '{}'::jsonb;
alter table employee_contracts add column if not exists storage_path text;
alter table employee_contracts add column if not exists bucket text;
create or replace function accept_invite(invite_token text, new_user_id uuid)
returns void as $$
declare
  inv invites;
  o jsonb;
  c jsonb;
  yr int := extract(year from now());
begin
  select * into inv from invites where token = invite_token and status = 'pending' and expires_at > now();
  if inv is null then
    raise exception 'Invalid or expired invite';
  end if;
  o := coalesce(inv.onboarding, '{}'::jsonb);
  insert into profiles (id, contact_id, contractor_id, role, full_name,
    job_title, department, employment_start_date, work_schedule, agreed_salary, salary_basis, commission_pct,
    annual_leave_days, sick_leave_days, special_leave_days, unpaid_leave_days,
    phone, id_passport, address, emergency_contact, salary_frequency, bonus_structure,
    module_access, benefits)
  values (
    new_user_id,
    case when inv.role <> 'contractor' then inv.contact_id else null end,
    case when inv.role = 'contractor' then inv.related_entity_id else null end,
    inv.role,
    coalesce(o->>'full_name', (select full_name from contacts where id = inv.contact_id)),
    nullif(o->>'position', ''),
    nullif(o->>'department', ''),
    nullif(o->>'start_date', '')::date,
    nullif(o->>'work_schedule', ''),
    nullif(o->>'agreed_salary', '')::numeric,
    nullif(o->>'salary_basis', ''),
    nullif(o->>'commission_pct', '')::numeric,
    nullif(o->>'annual_leave_days', '')::numeric,
    nullif(o->>'sick_leave_days', '')::numeric,
    nullif(o->>'special_leave_days', '')::numeric,
    nullif(o->>'unpaid_leave_days', '')::numeric,
    nullif(o->>'phone', ''),
    nullif(o->>'id_passport', ''),
    nullif(o->>'address', ''),
    nullif(o->>'emergency_contact', ''),
    nullif(o->>'salary_frequency', ''),
    nullif(o->>'bonus_structure', ''),
    coalesce(o->'module_access', '[]'::jsonb),
    coalesce(o->'benefits', '{}'::jsonb)
  );
  if coalesce((o->>'annual_leave_days')::numeric, 0) > 0 then
    insert into leave_balances (profile_id, leave_type, year, total_days)
    values (new_user_id, 'annual', yr, (o->>'annual_leave_days')::numeric)
    on conflict (profile_id, leave_type, year) do nothing;
  end if;
  if coalesce((o->>'sick_leave_days')::numeric, 0) > 0 then
    insert into leave_balances (profile_id, leave_type, year, total_days)
    values (new_user_id, 'sick', yr, (o->>'sick_leave_days')::numeric)
    on conflict (profile_id, leave_type, year) do nothing;
  end if;
  if coalesce((o->>'unpaid_leave_days')::numeric, 0) > 0 then
    insert into leave_balances (profile_id, leave_type, year, total_days)
    values (new_user_id, 'unpaid', yr, (o->>'unpaid_leave_days')::numeric)
    on conflict (profile_id, leave_type, year) do nothing;
  end if;
  for c in select * from jsonb_array_elements(coalesce(o->'contracts', '[]'::jsonb)) loop
    insert into employee_contracts (profile_id, type, title, status, start_date, expiry_date, renewal_date, probation_end_date, storage_path, bucket, created_by)
    values (
      new_user_id,
      coalesce(nullif(c->>'type', ''), 'contract'),
      coalesce(nullif(c->>'title', ''), 'Employment contract'),
      'active',
      nullif(c->>'start_date', '')::date,
      nullif(c->>'expiry_date', '')::date,
      nullif(c->>'renewal_date', '')::date,
      nullif(c->>'probation_end_date', '')::date,
      nullif(c->>'storage_path', ''),
      nullif(c->>'bucket', ''),
      inv.invited_by
    );
  end loop;
  update invites set status = 'accepted', accepted_at = now() where id = inv.id;
end;
$$ language plpgsql security definer;
create or replace function on_lead_created() returns trigger as $$
begin
  insert into activity_log (entity_type, entity_id, action, metadata)
  values ('lead', NEW.id, 'created', jsonb_build_object('source', NEW.source));
  perform pg_notify('lead_created', NEW.id::text);
  return NEW;
end;
$$ language plpgsql;
create or replace function set_default_lead_owner() returns trigger as $$
begin
  if NEW.assigned_to is not null and NEW.assigned_at is null then
    NEW.assigned_at := now();
  end if;
  return NEW;
end;
$$ language plpgsql;
create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  provider text not null default 'google',
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  calendar_id text default 'primary',
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (profile_id, provider)
);
alter table calendar_connections enable row level security;
drop policy if exists calendar_self on calendar_connections;
create policy calendar_self on calendar_connections for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
alter table tasks add column if not exists meeting_link text;
alter table follow_up_tasks add column if not exists meeting_link text;
alter table viewings add column if not exists meeting_link text;
alter table tasks add column if not exists google_event_id text;
alter table tasks add column if not exists calendar_synced_at timestamptz;
alter table follow_up_tasks add column if not exists google_event_id text;
alter table follow_up_tasks add column if not exists calendar_synced_at timestamptz;
alter table viewings add column if not exists google_event_id text;
alter table viewings add column if not exists calendar_synced_at timestamptz;
alter table tasks add column if not exists source_key text;
create unique index if not exists tasks_source_key_uniq on tasks (source_key) where source_key is not null;
create table if not exists learning_insights (
  id uuid primary key default gen_random_uuid(),
  kind text not null unique,
  payload jsonb not null default '{}',
  sample_size integer not null default 0,
  computed_at timestamptz not null default now()
);
alter table learning_insights enable row level security;
drop policy if exists learning_insights_staff_read on learning_insights;
create policy learning_insights_staff_read on learning_insights for select using (is_staff());
create table if not exists institutional_memory (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id uuid,
  tags text[] not null default '{}',
  importance text not null default 'normal',-- low | normal | high
  source_key text unique,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists institutional_memory_kind_idx on institutional_memory (kind);
create index if not exists institutional_memory_entity_idx on institutional_memory (entity_type, entity_id);
alter table institutional_memory enable row level security;
drop policy if exists institutional_memory_staff_read on institutional_memory;
create policy institutional_memory_staff_read on institutional_memory for select using (is_staff());
drop policy if exists institutional_memory_staff_write on institutional_memory;
create policy institutional_memory_staff_write on institutional_memory for insert with check (is_staff());
drop policy if exists institutional_memory_staff_update on institutional_memory;
create policy institutional_memory_staff_update on institutional_memory for update using (is_staff()) with check (is_staff());
create table if not exists land_parcels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  reference text not null,
  location text,
  area_ref text,
  plot_size_sqm numeric,
  stage text not null default 'new',
  location_quality integer,
  planning_uplift integer,
  frontage_m numeric,
  access_quality text,
  plot_shape text,
  density_potential integer,
  zone text,
  building_density numeric,
  seller_urgency integer,
  reason_for_selling text,
  flexibility integer,
  financial_pressure boolean not null default false,
  inheritance boolean not null default false,
  family_split boolean not null default false,
  current_value numeric,
  post_planning_value numeric,
  asking_price numeric,
  offer_amount numeric,
  assigned_to uuid references profiles(id) on delete set null,
  next_action_date timestamptz,
  last_contacted_at timestamptz,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists land_parcels_stage_idx on land_parcels (stage);
create index if not exists land_parcels_area_idx on land_parcels (area_ref);
create index if not exists land_parcels_contact_idx on land_parcels (contact_id);
alter table land_parcels enable row level security;
drop policy if exists land_parcels_staff_all on land_parcels;
create policy land_parcels_staff_all on land_parcels for all using (is_staff()) with check (is_staff());
alter table land_parcels
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists due_diligence jsonb not null default '{}'::jsonb,
  add column if not exists offer_inputs jsonb,
  add column if not exists relocation boolean not null default false,
  add column if not exists divorce boolean not null default false,
  add column if not exists debt_pressure boolean not null default false,
  add column if not exists timeline_to_sell text;
create table if not exists parcel_documents (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references land_parcels(id) on delete cascade,
  category text not null,
  name text not null,
  url text,
  note text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists parcel_documents_parcel_idx on parcel_documents (parcel_id);
alter table parcel_documents enable row level security;
drop policy if exists parcel_documents_staff_all on parcel_documents;
create policy parcel_documents_staff_all on parcel_documents for all using (is_staff()) with check (is_staff());
drop trigger if exists trg_default_lead_owner on leads;
create trigger trg_default_lead_owner before insert on leads
  for each row execute function set_default_lead_owner();

-- ── message templates (missing rows only) ──
insert into message_templates (channel, key, name, subject, body, audience) values
  ('whatsapp','first_contact','First contact (RU)', null, 'Здравствуйте, {{name}}! Спасибо за интерес к {{project}}. Меня зовут {{agent}}, я ваш персональный консультант Oramira. Когда вам удобно созвониться?','ru'),
  ('whatsapp','follow_up','Follow-up (RU)', null, '{{name}}, добрый день! Возвращаюсь по поводу {{project}}. С радостью отвечу на вопросы или организую просмотр.','ru'),
  ('whatsapp','first_contact','First contact (EL)', null, 'Γεια σας {{name}}! Ευχαριστούμε για το ενδιαφέρον σας για {{project}}. Είμαι ο/η {{agent}} από την Oramira — πότε σας βολεύει να μιλήσουμε;','el'),
  ('whatsapp','follow_up','Follow-up (EL)', null, '{{name}}, καλησπέρα! Επικοινωνώ ξανά για {{project}}. Είμαι στη διάθεσή σας για ερωτήσεις ή για να κανονίσουμε προβολή.','el'),
  ('email','nurture_intro','Nurture — Day 0 intro (RU)','Добро пожаловать в Oramira', 'Здравствуйте, {{name}}!<p>Меня зовут {{agent}}. В ближайшие дни я расскажу о {{project}} и рынке недвижимости Кипра, чтобы вы могли спокойно принять решение.</p>','ru'),
  ('email','nurture_market','Nurture — Day 3 market (RU)','Рынок Кипра сегодня', 'Здравствуйте, {{name}}!<p>Кратко о том, почему покупатели выбирают Кипр и {{project}} — высокая доходность, ВНЖ и образ жизни. С радостью пришлю полные цифры.</p>','ru'),
  ('email','nurture_objections','Nurture — Day 7 objections (RU)','Частые вопросы покупателей', 'Здравствуйте, {{name}}!<p>Несколько вопросов, которые часто задают покупатели — финансирование, процесс покупки и сроки. Буду рад всё объяснить.</p>','ru'),
  ('whatsapp','viewing_reminder','Viewing reminder (RU)', null, '{{name}}, напоминаю: ваш просмотр в {{project}} завтра, {{date}}. Дайте знать, если что-то изменится.','ru'),
  ('email','nurture_intro','Nurture — Day 0 intro (EL)','Καλώς ήρθατε στην Oramira', 'Αγαπητέ/ή {{name}},<p>Είμαι ο/η {{agent}}. Τις επόμενες μέρες θα σας μοιραστώ πληροφορίες για το {{project}} και την αγορά της Κύπρου, ώστε να αποφασίσετε με την ησυχία σας.</p>','el'),
  ('email','nurture_market','Nurture — Day 3 market (EL)','Η αγορά της Κύπρου σήμερα', 'Αγαπητέ/ή {{name}},<p>Μια σύντομη εικόνα γιατί οι αγοραστές επιλέγουν την Κύπρο και το {{project}} — αποδόσεις, οφέλη διαμονής και τρόπος ζωής. Ευχαρίστως να σας στείλω αναλυτικά στοιχεία.</p>','el'),
  ('email','nurture_objections','Nurture — Day 7 objections (EL)','Συχνές ερωτήσεις αγοραστών', 'Αγαπητέ/ή {{name}},<p>Μερικά θέματα που ρωτούν συχνά οι αγοραστές — χρηματοδότηση, διαδικασία αγοράς και χρονοδιαγράμματα. Είμαι στη διάθεσή σας.</p>','el'),
  ('whatsapp','viewing_reminder','Viewing reminder (EL)', null, '{{name}}, υπενθύμιση: η προβολή σας στο {{project}} είναι αύριο, {{date}}. Πείτε μου αν αλλάξει κάτι.','el'),
  ('whatsapp','reactivation','Reactivation (RU)', null, 'Здравствуйте, {{name}}! Это {{agent}} из Oramira. Давно не общались — рынок и {{project}} изменились, и я вспомнил о вас. Хотите краткое обновление? Без обязательств.','ru'),
  ('email','reactivation','Reactivation (RU)','Всё ещё думаете о Кипре?', 'Здравствуйте, {{name}}!<p>Давно не обсуждали {{project}}. На рынке Кипра многое изменилось — буду рад поделиться свежей информацией, когда вам будет удобно.</p><p>С уважением,<br/>{{agent}}</p>','ru'),
  ('whatsapp','reactivation','Reactivation (EL)', null, '{{name}}, εδώ ο/η {{agent}} από την Oramira. Έχει περάσει καιρός — η αγορά και το {{project}} έχουν εξελιχθεί και σας θυμήθηκα. Θέλετε μια σύντομη ενημέρωση; Χωρίς καμία πίεση.','el'),
  ('email','reactivation','Reactivation (EL)','Σκέφτεστε ακόμη την Κύπρο;', 'Αγαπητέ/ή {{name}},<p>Έχει περάσει καιρός από τότε που μιλήσαμε για το {{project}}. Πολλά έχουν αλλάξει στην αγορά της Κύπρου — ευχαρίστως να σας ενημερώσω όποτε σας βολεύει.</p><p>Με εκτίμηση,<br/>{{agent}}</p>','el'),
  ('whatsapp','landowner_intro','Landowner intro', null, 'Hello {{name}}, I''m {{agent}} from Oramira. We''re acquiring land in {{location}} and would value a brief conversation about your plot — no obligation. When suits you?','en'),
  ('whatsapp','landowner_follow_up','Landowner follow-up', null, 'Hi {{name}}, following up on your land in {{location}}. We remain interested and can move quickly — happy to discuss terms whenever you''re ready.','en'),
  ('email','landowner_intro','Landowner intro','Regarding your land in {{location}}', 'Dear {{name}},<p>I''m {{agent}} from Oramira. We''re actively acquiring land in {{location}} and would welcome a short, no-obligation conversation about your plot.</p><p>Kind regards,<br/>{{agent}}</p>','en'),
  ('email','landowner_follow_up','Landowner follow-up','Following up on your land', 'Dear {{name}},<p>Following up on your plot in {{location}} — we remain interested and can proceed quickly. I''d be glad to discuss terms at your convenience.</p>','en')
on conflict (channel, key, audience) do nothing;

notify pgrst, 'reload schema';
