-- Oramira OS — Migration 0019: add 'waiting' to the sales pipeline
-- Additive. Pipeline becomes:
-- new → contacted → qualified → waiting → viewing → negotiating → reserved → won / lost / nurture
-- (ADD VALUE lives in its own migration so it never shares a transaction with
--  statements that use it.)
alter type lead_status add value if not exists 'waiting' before 'viewing';
