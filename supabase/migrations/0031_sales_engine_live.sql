-- Oramira OS — Migration 0031: Sales Engine (live delivery, viewings, negotiation, reactivation)
-- Live message delivery analytics, the viewing scheduler, negotiation history,
-- and the dead-lead reactivation pipeline. Additive.

-- ── Delivery analytics on the unified timeline ──
-- status lifecycle stays: logged|queued|sent|delivered|read|failed|received,
-- plus email events opened|clicked|bounced. Timestamps let us report on each.
alter table contact_communications add column delivered_at timestamptz;
alter table contact_communications add column read_at timestamptz;
alter table contact_communications add column opened_at timestamptz;
alter table contact_communications add column clicked_at timestamptz;
alter table contact_communications add column error text;
create index if not exists idx_comms_provider_msg on contact_communications (provider_message_id);

-- ── Reactivation pipeline stage ──
alter type lead_status add value if not exists 'reactivation';

-- ── Viewing management ──
create table viewings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  contact_id uuid not null references contacts(id) on delete cascade,
  unit_id uuid references units(id),
  project_id uuid references projects(id),
  agent_id uuid references profiles(id),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled', -- scheduled | attended | no_show | cancelled
  notes text,
  reminder_sent_at timestamptz,
  follow_up_sent_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index idx_viewings_scheduled on viewings (scheduled_at);
create index idx_viewings_lead on viewings (lead_id);
alter table viewings enable row level security;
create policy viewings_staff_all on viewings for all using (is_staff()) with check (is_staff());

-- ── Negotiation history ──
create table negotiations (
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
create index idx_negotiations_lead on negotiations (lead_id, created_at desc);
alter table negotiations enable row level security;
create policy negotiations_staff_all on negotiations for all using (is_staff()) with check (is_staff());

-- ── Reactivation campaign templates (EN / RU / EL) ──
insert into message_templates (channel, key, name, subject, body, audience) values
  ('whatsapp','reactivation','Reactivation', null, 'Hi {{name}}, it''s {{agent}} from Oramira. It''s been a while — the market and {{project}} have moved on, and I thought of you. Would you like a quick update? No pressure at all.'),
  ('email','reactivation','Reactivation','Still thinking about Cyprus?', 'Dear {{name}},<p>It''s been a while since we spoke about {{project}}. A lot has changed in the Cyprus market and I''d be glad to share a fresh update whenever the timing is right for you.</p><p>Warm regards,<br/>{{agent}}</p>')
on conflict (channel, key, audience) do nothing;
insert into message_templates (channel, key, name, subject, body, audience) values
  ('whatsapp','reactivation','Reactivation (RU)', null, 'Здравствуйте, {{name}}! Это {{agent}} из Oramira. Давно не общались — рынок и {{project}} изменились, и я вспомнил о вас. Хотите краткое обновление? Без обязательств.','ru'),
  ('email','reactivation','Reactivation (RU)','Всё ещё думаете о Кипре?', 'Здравствуйте, {{name}}!<p>Давно не обсуждали {{project}}. На рынке Кипра многое изменилось — буду рад поделиться свежей информацией, когда вам будет удобно.</p><p>С уважением,<br/>{{agent}}</p>','ru'),
  ('whatsapp','reactivation','Reactivation (EL)', null, '{{name}}, εδώ ο/η {{agent}} από την Oramira. Έχει περάσει καιρός — η αγορά και το {{project}} έχουν εξελιχθεί και σας θυμήθηκα. Θέλετε μια σύντομη ενημέρωση; Χωρίς καμία πίεση.','el'),
  ('email','reactivation','Reactivation (EL)','Σκέφτεστε ακόμη την Κύπρο;', 'Αγαπητέ/ή {{name}},<p>Έχει περάσει καιρός από τότε που μιλήσαμε για το {{project}}. Πολλά έχουν αλλάξει στην αγορά της Κύπρου — ευχαρίστως να σας ενημερώσω όποτε σας βολεύει.</p><p>Με εκτίμηση,<br/>{{agent}}</p>','el')
on conflict (channel, key, audience) do nothing;
