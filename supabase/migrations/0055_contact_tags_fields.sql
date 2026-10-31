-- Oramira OS — Migration 0055: tags, groups and custom fields on contacts
-- Additive. The lists of allowed tags/groups and the custom field definitions
-- live in org_settings.data->tags (Settings → Tags, ομάδες & πεδία).

alter table contacts add column if not exists tags text[] not null default '{}';
alter table contacts add column if not exists groups text[] not null default '{}';
alter table contacts add column if not exists custom_fields jsonb not null default '{}'::jsonb;

create index if not exists idx_contacts_tags on contacts using gin (tags);
create index if not exists idx_contacts_groups on contacts using gin (groups);
