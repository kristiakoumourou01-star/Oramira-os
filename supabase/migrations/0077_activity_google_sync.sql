-- Activities (follow_up_tasks) κλείνονται στο ημερολόγιο του υπεύθυνου:
-- κρατάμε το Google event που δημιουργήθηκε και σε ποιον ανήκει (για αλλαγή ώρας / ανάθεσης).
alter table follow_up_tasks add column if not exists google_event_id text;
alter table follow_up_tasks add column if not exists google_profile_id uuid references profiles(id) on delete set null;
