-- Oramira OS — Migration 0045: Executive (institutional) memory
-- A persistent, searchable record of the things that matter across time:
-- decisions, major negotiations, owner/project history, employee issues, and
-- recurring risks. Entries are created by staff or auto-captured by the memory
-- job (deduped via source_key). Full-text search over title + body + tags.

create table if not exists institutional_memory (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- decision | negotiation | owner | project | employee | risk
  title text not null,
  body text not null default '',
  entity_type text,                         -- lead | contact | project | unit | employee | contract ...
  entity_id uuid,
  tags text[] not null default '{}',
  importance text not null default 'normal',-- low | normal | high
  source_key text unique,                   -- set for auto-captured entries (idempotent)
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists institutional_memory_kind_idx on institutional_memory (kind);
create index if not exists institutional_memory_entity_idx on institutional_memory (entity_type, entity_id);
create index if not exists institutional_memory_fts_idx on institutional_memory
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || array_to_string(tags, ' ')));

alter table institutional_memory enable row level security;
create policy institutional_memory_staff_read on institutional_memory for select using (is_staff());
create policy institutional_memory_staff_write on institutional_memory for insert with check (is_staff());
create policy institutional_memory_staff_update on institutional_memory for update using (is_staff()) with check (is_staff());
