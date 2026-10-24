-- Oramira OS — Migration 0027: sales-doctrine fields + audience templates
-- Additive. Audience segmentation on contacts, speed-to-lead timing on leads,
-- and per-audience message templates.

-- Audience logic (per person)
alter table contacts add column buyer_type text;             -- russian_cis | local_cypriot | international | other
alter table contacts add column communication_preference text; -- whatsapp | call | email
alter table contacts add column nurture_style text;            -- trust_first | fast_urgent | standard

-- Speed-to-lead: first MANUAL response timestamp (auto-welcome doesn't count)
alter table leads add column first_response_at timestamptz;

-- Per-audience templates: add the audience dimension (en | ru | el)
alter table message_templates add column audience text default 'en';
alter table message_templates drop constraint if exists message_templates_channel_key_key;
alter table message_templates add constraint message_templates_channel_key_audience_key unique (channel, key, audience);

-- Email nurture sequence templates (Day 0 / 3 / 7)
insert into message_templates (channel, key, name, subject, body, audience) values
  ('email','nurture_intro','Nurture — Day 0 intro','Welcome to Oramira', 'Dear {{name}},<p>Welcome — I''m {{agent}}. Over the coming days I''ll share a little about {{project}} and the Cyprus market so you can decide at your own pace.</p>','en'),
  ('email','nurture_market','Nurture — Day 3 market insights','The Cyprus market right now', 'Dear {{name}},<p>A quick snapshot of why buyers are choosing Cyprus and {{project}} — strong yields, residency benefits, and lifestyle. Happy to send full figures.</p>','en'),
  ('email','nurture_objections','Nurture — Day 7 objections','Questions buyers often ask', 'Dear {{name}},<p>A few things buyers commonly ask about — financing, the buying process, and timelines. I''d be glad to walk you through any of them.</p>','en')
on conflict (channel, key, audience) do nothing;

-- Audience variants (Russian / Greek) for the key WhatsApp touch-points
insert into message_templates (channel, key, name, subject, body, audience) values
  ('whatsapp','first_contact','First contact (RU)', null, 'Здравствуйте, {{name}}! Спасибо за интерес к {{project}}. Меня зовут {{agent}}, я ваш персональный консультант Oramira. Когда вам удобно созвониться?','ru'),
  ('whatsapp','follow_up','Follow-up (RU)', null, '{{name}}, добрый день! Возвращаюсь по поводу {{project}}. С радостью отвечу на вопросы или организую просмотр.','ru'),
  ('whatsapp','first_contact','First contact (EL)', null, 'Γεια σας {{name}}! Ευχαριστούμε για το ενδιαφέρον σας για {{project}}. Είμαι ο/η {{agent}} από την Oramira — πότε σας βολεύει να μιλήσουμε;','el'),
  ('whatsapp','follow_up','Follow-up (EL)', null, '{{name}}, καλησπέρα! Επικοινωνώ ξανά για {{project}}. Είμαι στη διάθεσή σας για ερωτήσεις ή για να κανονίσουμε προβολή.','el')
on conflict (channel, key, audience) do nothing;
