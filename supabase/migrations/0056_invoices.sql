-- 0056_invoices.sql — Οικονομικά → Τιμολόγια (βήμα 7δ του πλάνου)
--
-- Παραστατικά (τιμολόγια, αποδείξεις, πιστωτικά) με αρίθμηση ανά σειρά ΧΩΡΙΣ
-- κενά: ο αριθμός δίνεται μέσα στην ίδια συναλλαγή που γράφει το παραστατικό,
-- με κλείδωμα της σειράς, οπότε αν κάτι αποτύχει δεν «καίγεται» αριθμός.
-- Ένα εκδοθέν παραστατικό δεν αλλάζει και δεν διαγράφεται: διορθώνεται με
-- πιστωτικό. Ασφαλές να τρέξει ξανά (δεν σβήνει τίποτα).

-- ── Σειρές αρίθμησης ─────────────────────────────────────────────────────────
create table if not exists public.document_series (
  key text primary key check (key in ('invoice', 'receipt', 'credit_note')),
  label text not null,
  prefix text not null default '',
  next_number int not null default 1 check (next_number >= 1),
  updated_at timestamptz not null default now()
);

insert into public.document_series (key, label, prefix, next_number) values
  ('invoice', 'Τιμολόγια', 'INV-{YYYY}-', 1),
  ('receipt', 'Αποδείξεις', 'REC-{YYYY}-', 1),
  ('credit_note', 'Πιστωτικά', 'CN-{YYYY}-', 1)
on conflict (key) do nothing;

-- ── Παραστατικά ──────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('invoice', 'receipt', 'credit_note')),
  number text not null unique,
  seq int not null,
  issue_date date not null default current_date,
  due_date date,
  contact_id uuid references public.contacts(id),
  customer_name text not null,
  customer_email text,
  customer_address text,
  customer_vat_no text,
  project_id uuid references public.projects(id),
  unit_id uuid references public.units(id),
  related_id uuid references public.invoices(id),
  lines jsonb not null default '[]'::jsonb,
  vat_breakdown jsonb not null default '[]'::jsonb,
  net_total numeric(14,2) not null default 0,
  vat_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  payment_method text,
  notes text,
  status text not null default 'issued'
    check (status in ('issued', 'partially_paid', 'paid', 'partially_credited', 'credited')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_invoices_issue_date on public.invoices (issue_date desc);
create index if not exists idx_invoices_contact on public.invoices (contact_id);
create index if not exists idx_invoices_related on public.invoices (related_id);

alter table public.invoices enable row level security;
alter table public.document_series enable row level security;

-- Ανάγνωση για τους ρόλους γραφείου. Καμία πολιτική εγγραφής: γράφουν μόνο οι
-- συναρτήσεις παρακάτω, που καλούνται από τον server αφού ελέγξει δικαιώματα.
drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices for select
  using (current_app_role()::text in ('admin', 'management', 'finance', 'viewer'));
drop policy if exists document_series_read on public.document_series;
create policy document_series_read on public.document_series for select
  using (current_app_role()::text in ('admin', 'management', 'finance', 'viewer'));

-- ── Δεν αλλάζει, δεν διαγράφεται ─────────────────────────────────────────────
create or replace function public.invoices_guard() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Τα εκδοθέντα παραστατικά δεν διαγράφονται. Εκδώστε πιστωτικό.';
  end if;
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Τα εκδοθέντα παραστατικά δεν αλλάζουν. Εκδώστε πιστωτικό.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_invoices_guard on public.invoices;
create trigger trg_invoices_guard before update or delete on public.invoices
  for each row execute function public.invoices_guard();

-- ── Κατάσταση τιμολογίου από πληρωμές και πιστωτικά ──────────────────────────
create or replace function public.refresh_invoice_status(p_id uuid) returns void as $$
declare
  v_total numeric; v_credited numeric; v_paid numeric; v_status text;
begin
  select total into v_total from public.invoices where id = p_id and kind = 'invoice';
  if v_total is null then return; end if;
  select coalesce(sum(total), 0) into v_credited from public.invoices where related_id = p_id and kind = 'credit_note';
  select coalesce(sum(total), 0) into v_paid from public.invoices where related_id = p_id and kind = 'receipt';
  v_status := case
    when v_credited >= v_total then 'credited'
    when v_paid > 0 and v_paid >= v_total - v_credited then 'paid'
    when v_paid > 0 then 'partially_paid'
    when v_credited > 0 then 'partially_credited'
    else 'issued' end;
  update public.invoices set status = v_status where id = p_id and status is distinct from v_status;
end;
$$ language plpgsql security definer set search_path = public;

-- ── Έκδοση παραστατικού ─────────────────────────────────────────────────────
-- p_doc: { issue_date, due_date, contact_id, customer_name, customer_email,
--          customer_address, customer_vat_no, project_id, unit_id, related_id,
--          payment_method, notes, lines: [{description, qty, unit_price, vat_rate}] }
-- Τα σύνολα υπολογίζονται εδώ (όχι στον browser). Πιστωτικό χωρίς γραμμές =
-- ολική πίστωση του αρχικού. Απόδειξη έναντι τιμολογίου: δεν ξεπερνά το υπόλοιπο.
create or replace function public.issue_document(p_kind text, p_doc jsonb, p_actor uuid)
returns public.invoices as $$
declare
  s public.document_series;
  orig public.invoices;
  v_date date := coalesce(nullif(p_doc->>'issue_date', '')::date, current_date);
  v_lines jsonb := coalesce(p_doc->'lines', '[]'::jsonb);
  v_clean jsonb := '[]'::jsonb;
  ln jsonb;
  v_qty numeric; v_price numeric; v_rate numeric; v_net numeric; v_vat numeric;
  v_net_total numeric := 0; v_vat_total numeric := 0;
  v_breakdown jsonb;
  v_related uuid := nullif(p_doc->>'related_id', '')::uuid;
  v_already numeric; v_paid numeric;
  v_number text;
  r public.invoices;
begin
  if p_kind not in ('invoice', 'receipt', 'credit_note') then
    raise exception 'Άγνωστο είδος παραστατικού.';
  end if;

  if v_related is not null then
    if p_kind = 'invoice' then raise exception 'Ένα τιμολόγιο δεν αφορά άλλο τιμολόγιο.'; end if;
    select * into orig from public.invoices where id = v_related for update;
    if orig.id is null or orig.kind <> 'invoice' then
      raise exception 'Το σχετικό τιμολόγιο δεν βρέθηκε.';
    end if;
  elsif p_kind = 'credit_note' then
    raise exception 'Το πιστωτικό πρέπει να αφορά ένα τιμολόγιο.';
  end if;

  -- Πιστωτικό χωρίς γραμμές: ολική πίστωση (μόνο αν δεν υπάρχει άλλη πίστωση).
  if p_kind = 'credit_note' and jsonb_array_length(v_lines) = 0 then
    select coalesce(sum(total), 0) into v_already from public.invoices where related_id = orig.id and kind = 'credit_note';
    if v_already > 0 then
      raise exception 'Το τιμολόγιο έχει ήδη πιστωθεί (εν μέρει ή ολικά). Για νέο πιστωτικό δώστε τις γραμμές του.';
    end if;
    v_lines := orig.lines;
  end if;

  if jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) = 0 then
    raise exception 'Προσθέστε τουλάχιστον μία γραμμή.';
  end if;
  if jsonb_array_length(v_lines) > 100 then
    raise exception 'Έως 100 γραμμές ανά παραστατικό.';
  end if;

  for ln in select * from jsonb_array_elements(v_lines) loop
    v_qty := coalesce(nullif(ln->>'qty', '')::numeric, 1);
    v_price := coalesce(nullif(ln->>'unit_price', '')::numeric, 0);
    v_rate := coalesce(nullif(ln->>'vat_rate', '')::numeric, 0);
    if coalesce(trim(ln->>'description'), '') = '' then raise exception 'Κάθε γραμμή χρειάζεται περιγραφή.'; end if;
    if v_qty <= 0 then raise exception 'Η ποσότητα πρέπει να είναι πάνω από 0.'; end if;
    if v_price < 0 then raise exception 'Η τιμή δεν μπορεί να είναι αρνητική. Για μείωση εκδώστε πιστωτικό.'; end if;
    if v_rate < 0 or v_rate > 100 then raise exception 'Μη έγκυρος συντελεστής ΦΠΑ.'; end if;
    v_net := round(v_qty * v_price, 2);
    v_vat := round(v_net * v_rate / 100, 2);
    v_net_total := v_net_total + v_net;
    v_vat_total := v_vat_total + v_vat;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'description', left(trim(ln->>'description'), 500), 'qty', v_qty, 'unit_price', v_price,
      'vat_rate', v_rate, 'net', v_net, 'vat', v_vat));
  end loop;

  if v_net_total + v_vat_total <= 0 then
    raise exception 'Το σύνολο πρέπει να είναι πάνω από 0.';
  end if;

  if p_kind = 'credit_note' then
    select coalesce(sum(total), 0) into v_already from public.invoices where related_id = orig.id and kind = 'credit_note';
    if v_already + v_net_total + v_vat_total > orig.total + 0.005 then
      raise exception 'Το πιστωτικό ξεπερνά το υπόλοιπο του τιμολογίου (€%).', orig.total - v_already;
    end if;
  elsif p_kind = 'receipt' and v_related is not null then
    select coalesce(sum(total) filter (where kind = 'credit_note'), 0), coalesce(sum(total) filter (where kind = 'receipt'), 0)
      into v_already, v_paid
      from public.invoices where related_id = orig.id;
    if v_paid + v_net_total + v_vat_total > orig.total - v_already + 0.005 then
      raise exception 'Η είσπραξη ξεπερνά το υπόλοιπο του τιμολογίου (€%).', orig.total - v_already - v_paid;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('rate', rate, 'net', net, 'vat', vat) order by rate desc), '[]'::jsonb)
    into v_breakdown
    from (
      select (x->>'vat_rate')::numeric as rate, sum((x->>'net')::numeric) as net, sum((x->>'vat')::numeric) as vat
      from jsonb_array_elements(v_clean) x group by 1
    ) b;

  -- Κλείδωμα της σειράς: κανείς άλλος δεν παίρνει αριθμό μέχρι να τελειώσει
  -- αυτή η συναλλαγή. Αν αποτύχει, η αύξηση αναιρείται μαζί της.
  select * into s from public.document_series where key = p_kind for update;
  if s.key is null then raise exception 'Λείπει η σειρά αρίθμησης.'; end if;
  v_number := replace(s.prefix, '{YYYY}', to_char(v_date, 'YYYY')) || lpad(s.next_number::text, 4, '0');

  if coalesce(nullif(trim(p_doc->>'customer_name'), ''), orig.customer_name, '') = '' then
    raise exception 'Συμπληρώστε το όνομα του πελάτη.';
  end if;

  insert into public.invoices (
    kind, number, seq, issue_date, due_date, contact_id, customer_name, customer_email,
    customer_address, customer_vat_no, project_id, unit_id, related_id, lines, vat_breakdown,
    net_total, vat_total, total, payment_method, notes, created_by
  ) values (
    p_kind, v_number, s.next_number, v_date, nullif(p_doc->>'due_date', '')::date,
    coalesce(nullif(p_doc->>'contact_id', '')::uuid, orig.contact_id),
    coalesce(nullif(trim(p_doc->>'customer_name'), ''), orig.customer_name),
    coalesce(nullif(trim(p_doc->>'customer_email'), ''), orig.customer_email),
    coalesce(nullif(trim(p_doc->>'customer_address'), ''), orig.customer_address),
    coalesce(nullif(trim(p_doc->>'customer_vat_no'), ''), orig.customer_vat_no),
    coalesce(nullif(p_doc->>'project_id', '')::uuid, orig.project_id),
    coalesce(nullif(p_doc->>'unit_id', '')::uuid, orig.unit_id),
    v_related, v_clean, v_breakdown, v_net_total, v_vat_total, v_net_total + v_vat_total,
    nullif(trim(p_doc->>'payment_method'), ''), nullif(trim(p_doc->>'notes'), ''), p_actor
  ) returning * into r;

  update public.document_series set next_number = next_number + 1, updated_at = now() where key = p_kind;

  if v_related is not null then perform public.refresh_invoice_status(v_related); end if;
  return r;
end;
$$ language plpgsql security definer set search_path = public;

-- ── Αλλαγή σειράς από τις Ρυθμίσεις ──────────────────────────────────────────
-- Ο επόμενος αριθμός μπορεί μόνο να ανέβει (π.χ. για να συνεχίσει από παλιό
-- σύστημα). Να κατέβει επιτρέπεται μόνο αν δεν έχει εκδοθεί κανένα παραστατικό
-- αυτού του είδους — αλλιώς θα έβγαιναν διπλοί ή χαμένοι αριθμοί.
create or replace function public.update_document_series(p_key text, p_label text, p_prefix text, p_next int)
returns public.document_series as $$
declare
  s public.document_series;
  v_issued boolean;
begin
  select * into s from public.document_series where key = p_key for update;
  if s.key is null then raise exception 'Άγνωστη σειρά.'; end if;
  if p_next is null or p_next < 1 then raise exception 'Ο επόμενος αριθμός πρέπει να είναι 1 ή μεγαλύτερος.'; end if;
  select exists (select 1 from public.invoices where kind = p_key) into v_issued;
  if p_next < s.next_number and v_issued then
    raise exception 'Έχουν ήδη εκδοθεί παραστατικά. Ο επόμενος αριθμός δεν μπορεί να γίνει μικρότερος από %.', s.next_number;
  end if;
  update public.document_series
     set label = coalesce(nullif(trim(p_label), ''), label),
         prefix = left(coalesce(p_prefix, ''), 30),
         next_number = p_next,
         updated_at = now()
   where key = p_key
  returning * into s;
  return s;
end;
$$ language plpgsql security definer set search_path = public;

-- Μόνο ο server (service role) καλεί τις συναρτήσεις εγγραφής.
revoke all on function public.issue_document(text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.update_document_series(text, text, text, int) from public, anon, authenticated;
revoke all on function public.refresh_invoice_status(uuid) from public, anon, authenticated;
grant execute on function public.issue_document(text, jsonb, uuid) to service_role;
grant execute on function public.update_document_series(text, text, text, int) to service_role;
grant execute on function public.refresh_invoice_status(uuid) to service_role;
