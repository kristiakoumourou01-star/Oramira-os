-- Oramira OS — Migration 0065: τιμοκατάλογοι, ιστορικό τιμών, προγράμματα πληρωμών (βήμα 11β)
-- Additive, ασφαλές να τρέξει ξανά.

-- ── Ιστορικό τιμών: γράφεται αυτόματα σε κάθε αλλαγή units.price ──
create table if not exists unit_price_history (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  old_price numeric,
  new_price numeric,
  reason text,
  source text not null default 'manual',   -- manual | bulk | import | created
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists unit_price_history_unit_idx on unit_price_history (unit_id, changed_at desc);
create index if not exists unit_price_history_project_idx on unit_price_history (project_id, changed_at desc);
alter table unit_price_history enable row level security;
drop policy if exists unit_price_history_staff_all on unit_price_history;
create policy unit_price_history_staff_all on unit_price_history for all using (is_staff()) with check (is_staff());

-- Reason/source for a batch of changes come from transaction settings
-- (set by set_unit_prices); otherwise "manual".
create or replace function log_unit_price_change() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.price is not null then
      insert into unit_price_history (unit_id, project_id, old_price, new_price, reason, source, changed_by)
      values (new.id, new.project_id, null, new.price, nullif(current_setting('oramira.price_reason', true), ''),
              coalesce(nullif(current_setting('oramira.price_source', true), ''), 'created'), auth.uid());
    end if;
  elsif new.price is distinct from old.price then
    insert into unit_price_history (unit_id, project_id, old_price, new_price, reason, source, changed_by)
    values (new.id, new.project_id, old.price, new.price, nullif(current_setting('oramira.price_reason', true), ''),
            coalesce(nullif(current_setting('oramira.price_source', true), ''), 'manual'), auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_unit_price_history on units;
create trigger trg_unit_price_history after insert or update of price on units
  for each row execute function log_unit_price_change();

-- Change many prices at once with one reason. SECURITY INVOKER: RLS on units applies.
create or replace function set_unit_prices(p_changes jsonb, p_reason text default null, p_source text default 'bulk')
returns integer as $$
declare n integer;
begin
  perform set_config('oramira.price_reason', coalesce(p_reason, ''), true);
  perform set_config('oramira.price_source', coalesce(p_source, 'bulk'), true);
  update units u set price = (c->>'price')::numeric, updated_at = now()
    from jsonb_array_elements(p_changes) c
    where u.id = (c->>'id')::uuid and u.price is distinct from (c->>'price')::numeric;
  get diagnostics n = row_count;
  perform set_config('oramira.price_reason', '', true);
  perform set_config('oramira.price_source', '', true);
  return n;
end;
$$ language plpgsql security invoker set search_path = public;
revoke execute on function set_unit_prices(jsonb, text, text) from anon;

-- ── Εκδόσεις τιμοκαταλόγου (στιγμιότυπα για αποστολή/αρχείο) ──
create table if not exists price_lists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  note text,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists price_lists_project_idx on price_lists (project_id, created_at desc);
alter table price_lists enable row level security;
drop policy if exists price_lists_staff_all on price_lists;
create policy price_lists_staff_all on price_lists for all using (is_staff()) with check (is_staff());

-- ── Προγράμματα πληρωμών: βασικό ανά έργο, προαιρετικά δικό ανά μονάδα ──
alter table projects add column if not exists payment_plan jsonb not null default '[]'::jsonb;
alter table units add column if not exists payment_plan jsonb;   -- null = του έργου

notify pgrst, 'reload schema';
