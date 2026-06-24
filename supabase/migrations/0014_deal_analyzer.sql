-- Oramira OS — Migration 0014: Deal Analyzer
-- Internal acquisitions intelligence. Additive (don't edit 0001–0013).
-- The deals + deal_scenarios tables (migration 0003) already exist and are
-- staff-only under RLS (deals_staff_all, deal_scenarios_staff_all) — so this
-- module is internal-only with no further policy work. This migration adds the
-- analyzer's structured state and the AI advisory layer on top of the existing
-- numeric reporting columns.

-- Full structured inputs + computed outputs from lib/deal-analyzer.ts.
-- Stored as jsonb so the model can evolve without a migration per field; the
-- legacy numeric columns (net_profit, roi, gdv, …) are still mirrored on save
-- for list views and cross-module reporting.
alter table deals add column inputs jsonb default '{}';
alter table deals add column outputs jsonb default '{}';
alter table deals add column unit_mix jsonb default '[]';
alter table deals add column risk_breakdown jsonb default '{}';
alter table deals add column gross_profit numeric;
alter table deals add column break_even_price_per_sqm numeric;

-- AI advisory layer.
alter table deals add column ai_summary text;
alter table deals add column ai_strengths jsonb default '[]';
alter table deals add column ai_weaknesses jsonb default '[]';
alter table deals add column ai_red_flags jsonb default '[]';
alter table deals add column ai_recommended_strategy text;
alter table deals add column ai_suggested_pricing text;
alter table deals add column ai_generated_at timestamptz;
