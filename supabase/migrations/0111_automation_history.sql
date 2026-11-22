-- Oramira OS — Migration 0111: ιστορικό αποστολών των αυτοματισμών (Marketing → Αυτοματισμοί)
-- Ποιος αυτοματισμός έφτιαξε ποια καμπάνια (επαναλαμβανόμενα μηνύματα), και για κάθε
-- αποστολή γεγονότος: κανάλι και σύντομος λόγος όταν δεν στάλθηκε.
alter table marketing_campaigns add column if not exists automation_id uuid references marketing_automations(id) on delete set null;
create index if not exists idx_marketing_campaigns_automation on marketing_campaigns (automation_id, created_at desc) where automation_id is not null;
alter table marketing_automation_sends add column if not exists channel text;
-- archived | no_consent | no_address | no_app | no_provider | provider_error
alter table marketing_automation_sends add column if not exists reason text;

-- Όνομα αποστολέα ανά καμπάνια / αυτοματισμό (κενό = Ρυθμίσεις → Επικοινωνία).
alter table marketing_campaigns add column if not exists sender_name text;
alter table marketing_automations add column if not exists sender_name text;

-- Αγγλική εκδοχή του μηνύματος (οι πελάτες με γλώσσα εκτός από ελληνικά την παίρνουν).
alter table marketing_campaigns add column if not exists subject_en text;
alter table marketing_campaigns add column if not exists body_en text;
alter table marketing_automations add column if not exists subject_en text;
alter table marketing_automations add column if not exists body_en text;
