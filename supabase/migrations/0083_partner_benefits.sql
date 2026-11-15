-- Benefits (όπως στο FitnessCRM): παροχές / εκπτώσεις συνεργατών για αγοραστές
-- και ιδιοκτήτες (έπιπλα, τράπεζες, δικηγόροι, μετακόμιση…), με προβολές και πατήματα.
create table if not exists partner_benefits (
  id uuid primary key default gen_random_uuid(),
  partner text not null,
  title text not null,
  description text,
  discount text,
  category text,
  code text,
  link text,
  audience text[] not null default '{buyer,homeowner}',
  active boolean not null default true,
  valid_until date,
  views int not null default 0,
  taps int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table partner_benefits enable row level security;
create policy partner_benefits_staff_all on partner_benefits for all using (is_staff()) with check (is_staff());
create policy partner_benefits_read_active on partner_benefits for select using (active and auth.uid() is not null);
