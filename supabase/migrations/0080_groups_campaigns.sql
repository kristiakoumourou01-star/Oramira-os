-- Ομάδες πελατών (segments) και campaigns του Marketing.
create table if not exists contact_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  tags text[] not null default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table contact_groups enable row level security;
create policy contact_groups_staff_all on contact_groups for all using (is_staff()) with check (is_staff());

-- Οι ομάδες που υπήρχαν ήδη (στις ρυθμίσεις ή πάνω στις επαφές).
insert into contact_groups (name)
select distinct trim(g) from (
  select jsonb_array_elements_text(coalesce(data->'tags'->'groups', '[]'::jsonb)) g from org_settings
  union all
  select unnest(groups) from contacts
) s where trim(g) <> ''
on conflict (name) do nothing;

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  audience jsonb not null default '{}'::jsonb,
  subject text,
  preview text,
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'cancelled')),
  recipients int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table marketing_campaigns enable row level security;
create policy marketing_campaigns_staff_all on marketing_campaigns for all using (is_staff()) with check (is_staff());

alter table contact_communications add column if not exists campaign_id uuid references marketing_campaigns(id) on delete set null;
