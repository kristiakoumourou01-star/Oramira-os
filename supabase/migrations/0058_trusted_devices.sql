-- 0058_trusted_devices.sql — Ασφάλεια: εμπιστευμένες συσκευές για το 2FA (βήμα 7, τελευταίο κομμάτι)
--
-- Ο κωδικός μίας χρήσης (2FA / TOTP) είναι της ίδιας της Supabase (auth.mfa_factors).
-- Εδώ κρατάμε μόνο τις συσκευές που ο χρήστης είπε «να με θυμάσαι»: στη συσκευή
-- μένει ένα τυχαίο κλειδί σε cookie, εδώ μόνο το hash του. Λήγουν μόνες τους και
-- ο χρήστης ή ο admin τις ανακαλεί. Ασφαλές να τρέξει ξανά.

create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  ip text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists idx_trusted_devices_user on public.trusted_devices (user_id);

-- Μόνο ο server (service role) διαβάζει/γράφει. Κανένα δικαίωμα σε anon/authenticated.
alter table public.trusted_devices enable row level security;
revoke all on public.trusted_devices from anon, authenticated;
