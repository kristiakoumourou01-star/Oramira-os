-- Staff → «Νέο μέλος ομάδας»: χρώμα ημερολογίου ανά υπάλληλο, και η πρόσκληση
-- περνά πλέον στο προφίλ και ημερομηνία γέννησης, ρόλο από τους «Ρόλους»
-- (custom_role) και χρώμα ημερολογίου.
alter table profiles add column if not exists calendar_color text;
alter table profiles add column if not exists date_of_birth date;
alter table profiles add column if not exists custom_role text;

create or replace function accept_invite(invite_token text, new_user_id uuid)
returns void as $$
declare
  inv invites;
  o jsonb;
  c jsonb;
  yr int := extract(year from now());
begin
  select * into inv from invites where token = invite_token and status = 'pending' and expires_at > now();
  if inv is null then
    raise exception 'Invalid or expired invite';
  end if;
  o := coalesce(inv.onboarding, '{}'::jsonb);
  insert into profiles (id, contact_id, contractor_id, role, full_name,
    job_title, department, employment_start_date, work_schedule, agreed_salary, salary_basis, commission_pct,
    annual_leave_days, sick_leave_days, special_leave_days, unpaid_leave_days,
    phone, id_passport, address, emergency_contact, salary_frequency, bonus_structure,
    module_access, benefits, date_of_birth, custom_role, calendar_color)
  values (
    new_user_id,
    case when inv.role <> 'contractor' then inv.contact_id else null end,
    case when inv.role = 'contractor' then inv.related_entity_id else null end,
    inv.role,
    coalesce(o->>'full_name', (select full_name from contacts where id = inv.contact_id)),
    nullif(o->>'position', ''),
    nullif(o->>'department', ''),
    nullif(o->>'start_date', '')::date,
    nullif(o->>'work_schedule', ''),
    nullif(o->>'agreed_salary', '')::numeric,
    nullif(o->>'salary_basis', ''),
    nullif(o->>'commission_pct', '')::numeric,
    nullif(o->>'annual_leave_days', '')::numeric,
    nullif(o->>'sick_leave_days', '')::numeric,
    nullif(o->>'special_leave_days', '')::numeric,
    nullif(o->>'unpaid_leave_days', '')::numeric,
    nullif(o->>'phone', ''),
    nullif(o->>'id_passport', ''),
    nullif(o->>'address', ''),
    nullif(o->>'emergency_contact', ''),
    nullif(o->>'salary_frequency', ''),
    nullif(o->>'bonus_structure', ''),
    coalesce(o->'module_access', '[]'::jsonb),
    coalesce(o->'benefits', '{}'::jsonb),
    nullif(o->>'date_of_birth', '')::date,
    nullif(o->>'custom_role', ''),
    nullif(o->>'calendar_color', '')
  );
  if coalesce((o->>'annual_leave_days')::numeric, 0) > 0 then
    insert into leave_balances (profile_id, leave_type, year, total_days)
    values (new_user_id, 'annual', yr, (o->>'annual_leave_days')::numeric)
    on conflict (profile_id, leave_type, year) do nothing;
  end if;
  if coalesce((o->>'sick_leave_days')::numeric, 0) > 0 then
    insert into leave_balances (profile_id, leave_type, year, total_days)
    values (new_user_id, 'sick', yr, (o->>'sick_leave_days')::numeric)
    on conflict (profile_id, leave_type, year) do nothing;
  end if;
  if coalesce((o->>'unpaid_leave_days')::numeric, 0) > 0 then
    insert into leave_balances (profile_id, leave_type, year, total_days)
    values (new_user_id, 'unpaid', yr, (o->>'unpaid_leave_days')::numeric)
    on conflict (profile_id, leave_type, year) do nothing;
  end if;
  for c in select * from jsonb_array_elements(coalesce(o->'contracts', '[]'::jsonb)) loop
    insert into employee_contracts (profile_id, type, title, status, start_date, expiry_date, renewal_date, probation_end_date, storage_path, bucket, created_by)
    values (
      new_user_id,
      coalesce(nullif(c->>'type', ''), 'contract'),
      coalesce(nullif(c->>'title', ''), 'Employment contract'),
      'active',
      nullif(c->>'start_date', '')::date,
      nullif(c->>'expiry_date', '')::date,
      nullif(c->>'renewal_date', '')::date,
      nullif(c->>'probation_end_date', '')::date,
      nullif(c->>'storage_path', ''),
      nullif(c->>'bucket', ''),
      inv.invited_by
    );
  end loop;
  update invites set status = 'accepted', accepted_at = now() where id = inv.id;
end;
$$ language plpgsql security definer;
