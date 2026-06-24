-- Oramira OS — Migration 0005: cross-cutting systems used by every module:
-- documents, notes, activity log, tasks, notifications, messaging, invites.

create table documents (
  id uuid primary key default gen_random_uuid(),
  category document_category not null,
  storage_path text not null,
  bucket text not null,
  entity_type text not null, -- 'project' | 'unit' | 'contract' | 'ticket' | 'contractor' | 'investor'
  entity_id uuid not null,
  title text,
  uploaded_by uuid references profiles(id),
  visible_to_roles user_role[] default '{}',
  created_at timestamptz default now()
);
create index idx_documents_entity on documents (entity_type, entity_id);

-- attach deferred document FKs from earlier migrations
alter table units add constraint fk_units_floorplan foreign key (floorplan_document_id) references documents(id);
alter table contracts add constraint fk_contracts_document foreign key (document_id) references documents(id);
alter table contractor_invoices add constraint fk_invoices_document foreign key (document_id) references documents(id);

create table notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);
create index idx_notes_entity on notes (entity_type, entity_id);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  actor_id uuid references profiles(id),
  action text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index idx_activity_entity on activity_log (entity_type, entity_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id),
  related_entity_type text,
  related_entity_id uuid,
  due_at timestamptz,
  is_done boolean default false,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  channel notification_channel not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table notification_events (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null,
  entity_type text,
  entity_id uuid,
  channel notification_channel not null,
  recipient text not null,
  payload jsonb,
  status text default 'sent',
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null, -- 'ticket' | 'construction_task'
  entity_id uuid not null,
  sender_id uuid not null references profiles(id),
  body text not null,
  attachment_document_id uuid references documents(id),
  created_at timestamptz default now()
);
create index idx_messages_entity on messages (entity_type, entity_id);

create table invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role user_role not null,
  contact_id uuid references contacts(id),
  related_entity_type text,
  related_entity_id uuid,
  token text not null unique,
  status invite_status default 'pending',
  invited_by uuid references profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);
