-- Oramira OS — Migration 0001: Extensions & Enums

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create type user_role as enum (
  'admin', 'sales', 'management', 'buyer', 'homeowner', 'investor', 'contractor'
);

create type lead_source as enum (
  'website', 'meta', 'google', 'organic', 'referral', 'walk_in', 'other'
);

create type lead_status as enum (
  'new', 'contacted', 'qualified', 'negotiating', 'reserved', 'won', 'lost', 'nurture'
);

create type unit_status as enum (
  'available', 'reserved', 'sold', 'handed_over', 'blocked'
);

create type contract_status as enum ('draft', 'sent', 'signed', 'cancelled');

create type ticket_status as enum (
  'open', 'acknowledged', 'in_progress', 'awaiting_parts', 'resolved', 'closed', 'reopened'
);

create type ticket_priority as enum ('low', 'medium', 'high', 'emergency');

create type phase_type as enum (
  'permits', 'excavation', 'structure', 'mep', 'finishes', 'delivery'
);

create type milestone_status as enum ('not_started', 'in_progress', 'delayed', 'complete');

create type document_category as enum (
  'floorplan', 'drawing', 'specification', 'contract', 'warranty', 'manual',
  'invoice', 'legal', 'marketing', 'investor_report', 'other'
);

create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');

create type notification_channel as enum ('in_app', 'email');
