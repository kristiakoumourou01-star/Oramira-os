-- Oramira OS — Migration 0021: additional internal roles
-- Additive. Adds Finance, Construction, and Viewer to the user_role enum.
-- (Enum values live in their own migration so they're committed before any
--  policy/migration uses them.)
alter type user_role add value if not exists 'finance';
alter type user_role add value if not exists 'construction';
alter type user_role add value if not exists 'viewer';
