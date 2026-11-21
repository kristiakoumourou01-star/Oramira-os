-- Marketing: SMS ως κανάλι campaign. Tasks: λίστες κλήσεων (όπως στο FitnessCRM —
-- «λίστες κλήσεων από μια αναφορά, ανατεθειμένες στην ομάδα»), με πρόοδο x από N.

alter table marketing_campaigns drop constraint if exists marketing_campaigns_channel_check;
alter table marketing_campaigns add constraint marketing_campaigns_channel_check check (channel in ('email', 'sms', 'whatsapp', 'push'));

create table if not exists call_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  source text,                 -- από πού χτίστηκε (π.χ. «Custom report: Επενδυτές 500k+»)
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists idx_call_lists_assignee on call_lists (assigned_to, status);

create table if not exists call_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references call_lists(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  name text,
  phone text,
  email text,
  position int not null default 0,
  done boolean not null default false,
  outcome text,
  done_at timestamptz,
  done_by uuid references profiles(id) on delete set null
);
create index if not exists idx_call_list_items_list on call_list_items (list_id, position);

alter table call_lists enable row level security;
alter table call_list_items enable row level security;
drop policy if exists call_lists_staff_all on call_lists;
create policy call_lists_staff_all on call_lists for all using (is_staff()) with check (is_staff());
drop policy if exists call_list_items_staff_all on call_list_items;
create policy call_list_items_staff_all on call_list_items for all using (is_staff()) with check (is_staff());
