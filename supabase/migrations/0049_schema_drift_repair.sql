-- Oramira OS — Migration 0049: schema-drift repair (idempotent, additive only)
--
-- Two earlier additive migrations only PARTIALLY applied to this database — the
-- COLUMNS they add were missing even though their tables exist:
--   • 0020 (lead assignment): leads.assigned_by / assigned_at / next_action_date
--     / next_action_type, organizations.default_lead_owner_id
--   • 0027 (sales doctrine): leads.first_response_at, contacts.buyer_type /
--     communication_preference / nurture_style, message_templates.audience
--
-- Impact: PostgREST rejected the entire `leads` SELECT in getEnrichedLeads()
-- (missing `assigned_at`), which — because the error was swallowed — silently
-- emptied the Sales pipeline AND the dashboard Command Center.
--
-- This migration re-adds only the missing columns/constraint with IF NOT EXISTS,
-- so it is safe to run repeatedly and does NOT touch triggers, functions, RLS,
-- or data (no behavioural / business-logic change).

-- ── 0020: lead assignment + next-action metadata ──
alter table organizations add column if not exists default_lead_owner_id uuid references profiles(id);
alter table leads add column if not exists assigned_by uuid references profiles(id);
alter table leads add column if not exists assigned_at timestamptz;
alter table leads add column if not exists next_action_date date;
alter table leads add column if not exists next_action_type text; -- call | whatsapp | email | follow_up | viewing

-- ── 0027: sales-doctrine (speed-to-lead + audience segmentation) ──
alter table contacts add column if not exists buyer_type text;              -- russian_cis | local_cypriot | international | other
alter table contacts add column if not exists communication_preference text; -- whatsapp | call | email
alter table contacts add column if not exists nurture_style text;            -- trust_first | fast_urgent | standard
alter table leads add column if not exists first_response_at timestamptz;
alter table message_templates add column if not exists audience text default 'en';

-- Per-audience uniqueness (channel, key, audience). Existing rows default to
-- 'en', so this stays consistent with the prior (channel, key) uniqueness.
alter table message_templates drop constraint if exists message_templates_channel_key_key;
alter table message_templates drop constraint if exists message_templates_channel_key_audience_key;
alter table message_templates add constraint message_templates_channel_key_audience_key unique (channel, key, audience);

-- Refresh the PostgREST schema cache so the new columns are queryable at once.
notify pgrst, 'reload schema';
