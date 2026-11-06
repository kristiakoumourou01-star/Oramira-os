-- Oramira OS — Migration 0026: full sales-doctrine pipeline stages
-- Additive enum values (own migration so they commit before use). Pipeline:
-- new → contacted → engaged → qualified → waiting → viewing → offer →
-- negotiating → reserved → won / lost / nurture, plus no_response & retargeting.
alter type lead_status add value if not exists 'engaged' before 'qualified';
alter type lead_status add value if not exists 'offer' before 'negotiating';
alter type lead_status add value if not exists 'no_response';
alter type lead_status add value if not exists 'retargeting';
