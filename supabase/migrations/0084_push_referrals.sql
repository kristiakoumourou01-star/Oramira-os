-- Marketing όπως στο FitnessCRM: κανάλι Push (ειδοποίηση στην εφαρμογή των
-- αγοραστών / ιδιοκτητών) και Συστάσεις (κωδικοί με αμοιβή και για τους δύο).
alter table marketing_campaigns drop constraint if exists marketing_campaigns_channel_check;
alter table marketing_campaigns add constraint marketing_campaigns_channel_check check (channel in ('email', 'whatsapp', 'push'));
alter table marketing_campaigns add column if not exists opened int not null default 0;

create table if not exists referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  referrer_contact_id uuid references contacts(id) on delete set null,
  referrer_reward_type text not null default 'credit',
  referrer_reward_value numeric,
  referee_reward_type text not null default 'percent',
  referee_reward_value numeric,
  active boolean not null default true,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table referral_codes enable row level security;
create policy referral_codes_staff_all on referral_codes for all using (is_staff()) with check (is_staff());

create table if not exists referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references referral_codes(id) on delete cascade,
  referee_contact_id uuid references contacts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rewarded', 'rejected')),
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table referral_redemptions enable row level security;
create policy referral_redemptions_staff_all on referral_redemptions for all using (is_staff()) with check (is_staff());
