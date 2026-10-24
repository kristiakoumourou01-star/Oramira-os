-- Oramira OS — Migration 0034: House lifecycle
-- Turns each house into a full lifecycle asset: construction progress, utility
-- setup, and a key-handover checklist. Snagging/defects reuse maintenance
-- tickets; warranty expiry derives from warranty_start_date + period; future
-- payment schedules already exist via contracts. Additive.

alter table units add column construction_progress integer default 0; -- 0–100 %
alter table units add column utility_water text default 'not_connected';       -- not_connected | pending | active
alter table units add column utility_electricity text default 'not_connected';
alter table units add column utility_internet text default 'not_connected';
alter table units add column handover_checklist jsonb default '[]'::jsonb;      -- [{ label, done }]
