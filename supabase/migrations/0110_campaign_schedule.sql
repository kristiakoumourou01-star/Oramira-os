-- Oramira OS — Migration 0110: προγραμματισμένες καμπάνιες (Marketing → Καμπάνιες)
-- «Προγραμματισμός (ημερομηνία & ώρα)»: η καμπάνια περιμένει με status 'scheduled'
-- και τη στέλνει η εργασία marketing_automations (κάθε 15 λεπτά) όταν φτάσει το scheduled_at.
alter table marketing_campaigns add column if not exists scheduled_at timestamptz;
alter table marketing_campaigns drop constraint if exists marketing_campaigns_status_check;
alter table marketing_campaigns add constraint marketing_campaigns_status_check check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled'));
create index if not exists idx_marketing_campaigns_scheduled on marketing_campaigns (status, scheduled_at) where status = 'scheduled';
