-- Oramira OS — Migration 0025: communications + automation foundation
-- Additive. Provider-agnostic comms: a unified timeline, editable templates,
-- and an integrations (credentials) registry. No provider APIs are hardcoded.

-- ── Unified communication timeline (extend contact_communications) ──
alter table contact_communications add column lead_id uuid references leads(id);
alter table contact_communications add column body text;
alter table contact_communications add column status text default 'logged';
  -- logged | queued | sent | delivered | read | failed | received
alter table contact_communications add column provider text;
alter table contact_communications add column provider_message_id text;
alter table contact_communications add column template_key text;
alter table contact_communications add column ai_generated boolean default false;
create index idx_comms_lead on contact_communications (lead_id, occurred_at desc);

-- ── Message templates (WhatsApp + Email), editable ──
create table message_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null,        -- whatsapp | email
  key text not null,            -- first_contact, follow_up, ...
  name text not null,
  subject text,                 -- email only
  body text not null,           -- supports {{name}}, {{project}}, {{agent}} ...
  is_active boolean default true,
  updated_at timestamptz default now(),
  unique (channel, key)
);
alter table message_templates enable row level security;
create policy message_templates_staff_all on message_templates for all using (is_staff()) with check (is_staff());

-- ── Integrations / credentials registry (provider abstraction) ──
create table integrations (
  id uuid primary key default gen_random_uuid(),
  channel text not null,        -- whatsapp | email | instagram | facebook
  provider text not null,       -- twilio | meta | resend | smtp | log
  config jsonb default '{}',    -- credentials / settings (never exposed to client)
  is_active boolean default false,
  created_at timestamptz default now(),
  unique (channel)
);
alter table integrations enable row level security;
create policy integrations_staff_all on integrations for all using (is_staff()) with check (is_staff());

-- ── Seed default templates ──
insert into message_templates (channel, key, name, subject, body) values
  ('whatsapp','first_contact','First contact', null, 'Hi {{name}}, thank you for your interest in Oramira. I''m {{agent}}, your dedicated advisor — when would be a good time for a quick call?'),
  ('whatsapp','follow_up','Follow-up', null, 'Hi {{name}}, just following up on your interest in {{project}}. Happy to answer any questions or arrange a viewing.'),
  ('whatsapp','viewing_confirmation','Viewing confirmation', null, 'Hi {{name}}, your viewing at {{project}} is confirmed for {{date}}. See you then!'),
  ('whatsapp','viewing_reminder','Viewing reminder', null, 'Reminder: your viewing at {{project}} is tomorrow, {{date}}. Let me know if anything changes.'),
  ('whatsapp','offer_follow_up','Offer follow-up', null, 'Hi {{name}}, following up on the offer for {{project}}. I''m here to help with next steps whenever you''re ready.'),
  ('whatsapp','reservation_confirmation','Reservation confirmation', null, 'Congratulations {{name}}! Your reservation at {{project}} is confirmed. We''ll guide you through the next steps.'),
  ('whatsapp','payment_reminder','Payment reminder', null, 'Hi {{name}}, a friendly reminder that an installment for {{project}} is due. Let me know if you need anything.'),
  ('whatsapp','maintenance_acknowledgment','Maintenance acknowledgment', null, 'Hi {{name}}, we''ve received your maintenance request and will assign a contractor shortly.'),
  ('email','first_contact','First contact','Welcome to Oramira', 'Dear {{name}},<p>Thank you for your interest in Oramira. I''m {{agent}}, and I''ll be your point of contact. I''d be glad to arrange a viewing or answer any questions.</p>'),
  ('email','follow_up','Follow-up','Following up on your enquiry', 'Dear {{name}},<p>Just following up on your interest in {{project}}. Do let me know if you''d like to arrange a viewing.</p>'),
  ('email','viewing_confirmation','Viewing confirmation','Your viewing is confirmed', 'Dear {{name}},<p>Your viewing at {{project}} is confirmed for {{date}}.</p>'),
  ('email','reservation_confirmation','Reservation confirmation','Your reservation is confirmed', 'Dear {{name}},<p>Congratulations — your reservation at {{project}} is confirmed.</p>'),
  ('email','payment_reminder','Payment reminder','Upcoming payment', 'Dear {{name}},<p>This is a reminder that an installment for {{project}} is due.</p>'),
  ('email','maintenance_acknowledgment','Maintenance received','We received your request', 'Dear {{name}},<p>We''ve received your maintenance request and will assign a contractor shortly.</p>')
on conflict (channel, key) do nothing;
