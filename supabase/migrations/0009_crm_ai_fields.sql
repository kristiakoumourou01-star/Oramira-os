-- Oramira OS — Migration 0009: CRM enhancement
-- Separates "next step recommendation" from "summary" — they answer
-- different questions (what happened vs. what to do about it) and the
-- CRM UI renders them as two distinct panels.

alter table leads add column ai_next_steps text;
