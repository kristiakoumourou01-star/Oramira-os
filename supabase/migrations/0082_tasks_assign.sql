-- Tasks (Marketing → Tasks): προτεραιότητα, ποιος την ανέθεσε, ανάθεση σε όλη
-- την ομάδα (ένα αντίγραφο ανά άτομο με κοινό group_id), λίστα, αποτέλεσμα.
alter table tasks add column if not exists priority text not null default 'normal';
alter table tasks add column if not exists created_by uuid references profiles(id) on delete set null;
alter table tasks add column if not exists group_id uuid;
alter table tasks add column if not exists list text;
alter table tasks add column if not exists completed_at timestamptz;
alter table tasks add column if not exists outcome text;
create index if not exists idx_tasks_group on tasks (group_id);
create index if not exists idx_tasks_assignee_open on tasks (assigned_to, is_done);
