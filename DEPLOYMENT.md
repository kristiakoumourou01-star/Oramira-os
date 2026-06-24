# Oramira OS — Production Launch Setup

Everything needed to take Oramira OS from repo to live. Nothing here builds new
features — it's the setup, migration order, and the manual steps the code
cannot do for itself.

---

## 1. Supabase setup reference

### 1.1 Database tables (48, created across migrations 0002–0015)

| Migration | Tables |
|---|---|
| `0002` Identity + CRM | `organizations`, `contacts`, `profiles`, `leads`, `buyers`, `investors`, `contact_communications`, `follow_up_tasks`, `website_submissions`, `newsletter_subscribers` |
| `0003` Projects + Deals | `projects`, `buildings`, `project_phases`, `units`, `project_milestones`, `deals`, `deal_scenarios` |
| `0004` Sales / Homeowners / Contractors | `reservations`, `contracts`, `payment_schedules`, `payments`, `homeowners`, `contractors`, `maintenance_tickets`, `ticket_photos`, `ticket_updates`, `warranties`, `construction_tasks`, `contractor_performance_notes`, `contractor_invoices`, `contractor_project_assignments`, `project_team_contacts`, `investor_holdings`, `investor_projections` |
| `0005` Cross-cutting | `documents`, `notes`, `activity_log`, `tasks`, `notifications`, `notification_events`, `messages`, `invites` |
| `0011` Buyer Portal | `announcements`, `handover_checklist_items` |
| `0012` Homeowner Portal | `contractor_visits` |
| `0013` Contractor Portal | `material_requests`, `contractor_job_notes` |
| `0015` Automation Center | `automation_runs` |

`contacts` is the single identity table — every person resolves to one
`contact_id` via `find_or_create_contact()`.

### 1.2 Migration order — run 0001 → 0016 in filename order (do not reorder)

| File | Purpose |
|---|---|
| `0001_extensions_and_enums` | `pgcrypto`, `pg_trgm`; all enums incl. `user_role` |
| `0002_identity_and_crm` | identity + CRM tables |
| `0003_projects_and_deals` | projects, units, deals |
| `0004_sales_homeowners_contractors` | sales chain → maintenance |
| `0005_documents_..._invites` | documents, notes, tasks, notifications, messages, invites |
| `0006_functions_and_triggers` | `find_or_create_contact`, `accept_invite`, `suggest_contractors`, `is_staff()`, RLS helpers, triggers |
| `0007_row_level_security` | RLS policies (deny-by-default everywhere) |
| `0008_storage_buckets` | 5 buckets + storage.objects policies |
| `0009_crm_ai_fields` | `leads.ai_next_steps` |
| `0010_projects_units_module` | unit attrs, reservation expiry fn |
| `0011_buyer_portal` | announcements, handover checklist, buyer messaging RLS |
| `0012_homeowner_portal` | contractor visits, ticket category/warranty link |
| `0013_contractor_portal` | material requests, internal notes, contractor read fns |
| `0014_deal_analyzer` | deal inputs/outputs/AI columns |
| `0015_automation_center` | `automation_runs` log |
| `0016_security_hardening` | **`organizations` RLS** (final gap closed) |

Apply with the Supabase CLI:
```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/*.sql in order
```

### 1.3 Storage buckets (all private — access via signed URLs only)

| Bucket | Used for | Writers |
|---|---|---|
| `project-media` | gallery, floorplans, site photos | staff |
| `contracts` | contracts, receipts, legal | staff |
| `defect-reports` | ticket photos/videos, completion photos | homeowner, contractor |
| `investor-documents` | investor reports (module pending) | staff |
| `contractor-invoices` | contractor invoices | contractor |

Created automatically by migration `0008` — no manual bucket creation needed.
Storage policies: `storage_staff_all`, `storage_external_read`,
`storage_contractor_write`, `storage_homeowner_write`.

### 1.4 RLS policies

**Every one of the 48 tables has RLS enabled** (verified). ~90 row policies
total, deny-by-default. Pattern: a `*_staff_all` policy (`is_staff()`) on every
table, plus scoped external-role policies. External access is **contact-keyed**
(`owns_unit_as_buyer`/`owns_unit_as_homeowner` → `current_contact_id()`), which
is why a buyer keeps their access after becoming a homeowner. Tables with the
most policies: `units` (5), `documents` (5), `messages` (4), `maintenance_tickets`
(4), `construction_tasks` (4).

### 1.5 Auth roles (`user_role` enum)

Staff: **`admin`**, **`sales`**, **`management`** → internal workbench (`/dashboard`, `/crm`, `/projects`, `/deal-analyzer`, `/financials`, `/automation`).
External: **`buyer`**, **`homeowner`**, **`investor`**, **`contractor`** → their portal only.

There is **no self-registration**. The only way in is `accept_invite()` via
`/invite/[token]`; staff accounts are provisioned manually (see §5).

---

## 2. Environment variables

See `.env.example`. Summary:

| Variable | Tier | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required | Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | required | **server-only**; intake/automation/notifications |
| `NEXT_PUBLIC_APP_URL` | required | builds invite/reset/email links |
| `CRON_SECRET` | required | guards `/api/cron` |
| `ANTHROPIC_API_KEY` | recommended | AI advisory; falls back to heuristics if unset |
| `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` | recommended | email send; in-app notifications work without it |
| `INTAKE_SECRET` | optional | locks public intake to `x-intake-key` header |
| `WEBSITE_ALLOWED_ORIGIN` | optional | CORS origin for the marketing site |
| `INTERNAL_ALERTS_EMAIL`, `DEFAULT_LEGAL_EMAIL`, `DEFAULT_ARCHITECT_EMAIL` | optional | fallback recipients |
| `SUPABASE_PROJECT_ID` | local only | for `npm run supabase:types` |

---

## 3. Deployment checklist

### A. Supabase project
1. Create a project at supabase.com; note the project-ref.
2. Copy URL + anon key + service-role key (Settings → API).

### B. Migrations
3. `supabase link --project-ref <ref>` then `supabase db push`.
4. (Recommended) `npm run supabase:types` to regenerate `types/database.types.ts`
   from the live schema, replacing the hand-authored scaffold types.

### C. Storage
5. Confirm the 5 buckets exist (Storage tab) — created by `0008`. No action if present.

### D. Auth setup
6. Authentication → URL Configuration: set **Site URL** = your app URL and add
   redirect URLs (`https://<app>/invite/*`, `/reset-password`, `/login`).
7. Authentication → Providers → Email: **enable Email signups** (the invite flow
   calls `auth.signUp`) and **disable "Confirm email"** — invites are the trusted
   entry point, so confirmation would block the immediate post-invite sign-in.
8. (Manual) Enable **Realtime** for live notifications + message threads — see §4.

### E. Local run
```bash
npm install
cp .env.example .env.local      # fill in the values
npm run dev                     # http://localhost:3000
```
Build sanity check: `npm run build` (verified green: 35/35 pages, 0 type errors).

### F. Vercel deployment
9. Import the repo into Vercel (Framework: Next.js — auto-detected).
10. Add every env var from §2 in Project Settings → Environment Variables.
11. Deploy. `vercel.json` registers the 6 cron schedules automatically (requires a
    plan with Cron Jobs). Vercel auto-sends `CRON_SECRET` as the bearer token.
12. After deploy, hit `/login`, sign in as the admin you created in §5, and
    smoke-test `/dashboard`.

---

## 4. Manual setup still required before first launch

These cannot be done by `db push` / `vercel deploy` and must be done once:

1. **First admin user** — see §5. Without it, no one can sign in.

2. **Realtime** — the notification bell and the buyer/homeowner/contractor
   message threads use Postgres Realtime. Initial loads work without it; **live
   push** requires adding the tables to the realtime publication. Run once in the
   Supabase SQL editor:
   ```sql
   alter publication supabase_realtime add table notifications;
   alter publication supabase_realtime add table messages;
   ```

3. **Cron scheduling** — pick ONE:
   - **Vercel Cron** (default): `vercel.json` handles it on deploy. Just ensure
     `CRON_SECRET` is set in Vercel and the plan supports Cron Jobs.
   - **Supabase Edge Function**: `supabase functions deploy automations`, then
     `supabase secrets set APP_URL=<url> CRON_SECRET=<secret>`, and schedule it
     in the dashboard. It delegates to `/api/cron`.

4. **Email sending (Resend)** — verify your sending domain (DNS records) in
   Resend before transactional emails (invites, reminders) will deliver. Until
   then, emails are recorded in `notification_events` but not sent.

5. **Next.js security patch** — `next@14.2.5` has a published advisory (flagged by
   npm at install). Before public launch, bump to the latest patched `14.2.x` and
   re-run `npm run build`.

6. **AI key (optional)** — set `ANTHROPIC_API_KEY` to enable real lead scoring and
   Deal Analyzer advisory; otherwise deterministic fallbacks are used.

---

## 5. Create the first admin (no self-registration by design)

1. Supabase → Authentication → **Add user** (email + password); copy the new user's UUID.
2. In the SQL editor:
   ```sql
   -- optional: create a contact identity for the admin
   insert into contacts (email, full_name)
   values ('admin@oramira.com', 'Admin')
   on conflict (email) do nothing;

   insert into profiles (id, role, full_name, contact_id)
   values (
     '<auth-user-uuid>',
     'admin',
     'Admin',
     (select id from contacts where email = 'admin@oramira.com')
   );
   ```
3. Sign in at `/login`. From there, staff invite buyers/investors/contractors and
   activate portals through the app — every other account enters via `accept_invite()`.
