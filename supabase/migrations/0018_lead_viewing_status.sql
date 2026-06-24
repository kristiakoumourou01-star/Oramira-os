-- Oramira OS — Migration 0018: add 'viewing' to the sales pipeline
-- Additive (don't edit 0001–0017). Inserts the Viewing stage between
-- Qualified and Negotiating so the pipeline is:
-- new → contacted → qualified → viewing → negotiating → reserved → won / lost / nurture
alter type lead_status add value if not exists 'viewing' before 'negotiating';
