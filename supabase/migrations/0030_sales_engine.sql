-- Oramira OS — Migration 0030: Sales Automation Engine
-- Per-audience nurture sequences (RU/EL) and viewing reminders so every
-- buyer-type gets first-contact + follow-up + a full nurture sequence in their
-- own language. Additive; English variants already seeded in 0025/0027.

-- ── Russian / CIS nurture sequence + touch-points ──
insert into message_templates (channel, key, name, subject, body, audience) values
  ('email','nurture_intro','Nurture — Day 0 intro (RU)','Добро пожаловать в Oramira', 'Здравствуйте, {{name}}!<p>Меня зовут {{agent}}. В ближайшие дни я расскажу о {{project}} и рынке недвижимости Кипра, чтобы вы могли спокойно принять решение.</p>','ru'),
  ('email','nurture_market','Nurture — Day 3 market (RU)','Рынок Кипра сегодня', 'Здравствуйте, {{name}}!<p>Кратко о том, почему покупатели выбирают Кипр и {{project}} — высокая доходность, ВНЖ и образ жизни. С радостью пришлю полные цифры.</p>','ru'),
  ('email','nurture_objections','Nurture — Day 7 objections (RU)','Частые вопросы покупателей', 'Здравствуйте, {{name}}!<p>Несколько вопросов, которые часто задают покупатели — финансирование, процесс покупки и сроки. Буду рад всё объяснить.</p>','ru'),
  ('whatsapp','viewing_reminder','Viewing reminder (RU)', null, '{{name}}, напоминаю: ваш просмотр в {{project}} завтra, {{date}}. Дайте знать, если что-то изменится.','ru')
on conflict (channel, key, audience) do nothing;

-- ── Greek / Local Cypriot nurture sequence + touch-points ──
insert into message_templates (channel, key, name, subject, body, audience) values
  ('email','nurture_intro','Nurture — Day 0 intro (EL)','Καλώς ήρθατε στην Oramira', 'Αγαπητέ/ή {{name}},<p>Είμαι ο/η {{agent}}. Τις επόμενες μέρες θα σας μοιραστώ πληροφορίες για το {{project}} και την αγορά της Κύπρου, ώστε να αποφασίσετε με την ησυχία σας.</p>','el'),
  ('email','nurture_market','Nurture — Day 3 market (EL)','Η αγορά της Κύπρου σήμερα', 'Αγαπητέ/ή {{name}},<p>Μια σύντομη εικόνα γιατί οι αγοραστές επιλέγουν την Κύπρο και το {{project}} — αποδόσεις, οφέλη διαμονής και τρόπος ζωής. Ευχαρίστως να σας στείλω αναλυτικά στοιχεία.</p>','el'),
  ('email','nurture_objections','Nurture — Day 7 objections (EL)','Συχνές ερωτήσεις αγοραστών', 'Αγαπητέ/ή {{name}},<p>Μερικά θέματα που ρωτούν συχνά οι αγοραστές — χρηματοδότηση, διαδικασία αγοράς και χρονοδιαγράμματα. Είμαι στη διάθεσή σας.</p>','el'),
  ('whatsapp','viewing_reminder','Viewing reminder (EL)', null, '{{name}}, υπενθύμιση: η προβολή σας στο {{project}} είναι αύριο, {{date}}. Πείτε μου αν αλλάξει κάτι.','el')
on conflict (channel, key, audience) do nothing;
