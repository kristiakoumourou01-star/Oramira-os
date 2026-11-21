-- Ο λογαριασμός μου → Τα tickets μου (αιτήματα υποστήριξης από το προσωπικό προς τον διαχειριστή)
-- και προτιμήσεις ειδοποιήσεων ανά χρήστη.
create table if not exists staff_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id) on delete cascade,
  subject text not null,
  body text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_tickets_created_by_idx on staff_tickets(created_by, created_at desc);

create table if not exists staff_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references staff_tickets(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists staff_ticket_replies_ticket_idx on staff_ticket_replies(ticket_id, created_at);

alter table staff_tickets enable row level security;
alter table staff_ticket_replies enable row level security;

drop policy if exists staff_tickets_own on staff_tickets;
create policy staff_tickets_own on staff_tickets for all
  using (created_by = auth.uid() or current_app_role() = 'admin')
  with check (created_by = auth.uid() or current_app_role() = 'admin');

drop policy if exists staff_ticket_replies_own on staff_ticket_replies;
create policy staff_ticket_replies_own on staff_ticket_replies for all
  using (exists (select 1 from staff_tickets t where t.id = ticket_id and (t.created_by = auth.uid() or current_app_role() = 'admin')))
  with check (exists (select 1 from staff_tickets t where t.id = ticket_id and (t.created_by = auth.uid() or current_app_role() = 'admin')));

alter table profiles add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
