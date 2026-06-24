-- Oramira OS — Migration 0002: Identity layer + CRM
-- Single source of identity: contacts table, matched by unique email.
-- Every role record (lead/buyer/investor/homeowner/newsletter) hangs off
-- contact_id so a person is never duplicated as they move through their
-- lifecycle with Oramira.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Oramira',
  notification_settings jsonb default '{
    "internal_alerts_email": null,
    "default_legal_email": null,
    "default_architect_email": null
  }',
  settings jsonb default '{}',
  created_at timestamptz default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  phone text,
  nationality text,
  preferred_language text default 'en',
  is_lead boolean default false,
  is_buyer boolean default false,
  is_investor boolean default false,
  is_homeowner boolean default false,
  is_newsletter_subscriber boolean default false,
  first_touch_source lead_source,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_contacts_email_trgm on contacts using gin (email gin_trgm_ops);

-- profiles, leads, buyers, investors reference projects(id) further below,
-- so leads.preferred_project_id is added as a deferred FK once projects
-- exists (see migration 0003 — alter table leads add constraint).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  contact_id uuid references contacts(id),
  contractor_id uuid, -- FK added in 0004 once contractors exists
  role user_role not null,
  full_name text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  status lead_status default 'new',
  source lead_source not null,
  budget_min numeric,
  budget_max numeric,
  preferred_project_id uuid, -- FK added in 0003
  timeline_to_buy text,
  message text,
  assigned_to uuid references profiles(id),
  ai_score int,
  ai_score_reasoning text,
  ai_summary text,
  ai_summary_generated_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table buyers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  originating_lead_id uuid references leads(id),
  portal_eligible boolean default false,
  portal_activated boolean default false,
  portal_activated_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table investors (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  investor_type text,
  notes text,
  created_at timestamptz default now()
);

create table contact_communications (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  channel text not null,
  direction text not null,
  summary text,
  occurred_at timestamptz default now(),
  logged_by uuid references profiles(id)
);

create table follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  contact_id uuid references contacts(id),
  assigned_to uuid references profiles(id),
  due_at timestamptz not null,
  note text,
  is_done boolean default false,
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);

-- Website lead capture & newsletter — raw capture kept permanently for audit,
-- matched into contacts via find_or_create_contact() (migration 0006).
create table website_submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'contact_form' | 'newsletter'
  name text,
  email text not null,
  phone text,
  budget text,
  project_interest_id uuid, -- FK added in 0003
  message text,
  source lead_source default 'website',
  contact_id uuid references contacts(id),
  lead_id uuid references leads(id),
  processed_at timestamptz,
  created_at timestamptz default now()
);

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  email text not null unique,
  source lead_source default 'website',
  tags text[] default '{}',
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz
);
