-- Oramira OS — Migration 0043: WhatsApp meeting reminders
-- Extends the WhatsApp automation layer from viewings to planner meetings and
-- homeowner maintenance. A reminder marker on calendar_events makes the cron
-- idempotent; audience-aware templates keep the layer language-aware.

alter table calendar_events add column if not exists reminder_sent_at timestamptz;

-- Meeting reminder (planner events linked to a lead/contact) + owner maintenance.
insert into message_templates (channel, key, name, subject, body, audience) values
  ('whatsapp','meeting_reminder','Meeting reminder', null, 'Hi {{name}}, a reminder about our meeting "{{title}}" at {{time}} today. Looking forward to it — let me know if anything changes.','en'),
  ('whatsapp','meeting_reminder','Meeting reminder (RU)', null, '{{name}}, напоминаю о нашей встрече «{{title}}» сегодня в {{time}}. Дайте знать, если что-то изменится.','ru'),
  ('whatsapp','meeting_reminder','Meeting reminder (EL)', null, '{{name}}, υπενθύμιση για τη συνάντησή μας «{{title}}» σήμερα στις {{time}}. Πείτε μου αν αλλάξει κάτι.','el'),
  ('whatsapp','owner_maintenance_reminder','Owner maintenance reminder', null, 'Hi {{name}}, an update on your maintenance request: {{title}}. {{detail}}','en'),
  ('whatsapp','owner_maintenance_reminder','Owner maintenance reminder (RU)', null, '{{name}}, обновление по вашей заявке на обслуживание: {{title}}. {{detail}}','ru'),
  ('whatsapp','owner_maintenance_reminder','Owner maintenance reminder (EL)', null, '{{name}}, ενημέρωση για το αίτημα συντήρησής σας: {{title}}. {{detail}}','el')
on conflict (channel, key, audience) do nothing;
