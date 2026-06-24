# Oramira OS

The Oramira operating system — internal CRM, Deal Analyzer, and four client
portals (Buyer, Homeowner, Investor, Contractor), unified on one Next.js +
Supabase codebase. This README covers the **foundation** that's been built;
feature modules are built on top of it one at a time.

## Stack

Next.js 14 (App Router) · Supabase (Postgres, Auth, Storage, Realtime) ·
Tailwind CSS · Vercel

## What's in the foundation

| System | Where | Status |
|---|---|---|
| Database schema (all tables, Phases 2–4) | `supabase/migrations/0001`–`0005` | ✅ complete |
| RLS policies (every table, every role) | `supabase/migrations/0007` | ✅ complete |
| Storage buckets + storage-level policies | `supabase/migrations/0008` | ✅ complete |
| Identity matching (`find_or_create_contact`) | `supabase/migrations/0006` | ✅ complete |
| Invite acceptance (`accept_invite`) | `supabase/migrations/0006`, `app/actions/auth.ts` | ✅ complete |
| Contractor suggestion engine | `supabase/migrations/0006` (`suggest_contractors`) | ✅ complete |
| Buyer Portal eligibility + activation trigger | `supabase/migrations/0006`, `app/actions/invites.ts` | ✅ complete |
| Auth (login, invite, reset password) | `app/(auth)/*` | ✅ complete |
| Route-group protection (staff vs each portal role) | `middleware.ts` | ✅ complete |
| Internal + Portal layout shells, brand system | `components/layout/*`, `app/globals.css` | ✅ complete |
| Notifications (in-app, realtime) | `components/ui/NotificationBell.tsx`, `lib/notifications.ts` | ✅ complete |
| Activity log | `lib/activity.ts`, `components/ui/ActivityFeed.tsx` | ✅ complete |
| Task system | `app/actions/tasks.ts`, `components/ui/TaskList.tsx` | ✅ complete |
| Messaging (ticket/task threads) | `app/actions/messages.ts`, `components/portal/MessageThread.tsx` | ✅ complete |
| Document management (upload, signed URLs) | `lib/storage.ts`, `components/ui/DocumentList.tsx` | ✅ complete |
| **CRM** — lead pipeline, AI scoring/summary/next-steps, call & email logs, notes, follow-ups, buyer/investor linkage, portal activation | `app/(internal)/crm/*`, `components/crm/*`, `app/actions/leads.ts`, `lib/ai.ts` | ✅ complete |
| **Projects & Units** — projects/buildings/phases, construction timeline & permits, contractor assignments, project documents & gallery; unit inventory (specs, beds/baths, pricing, payment plan, handover, warranty, defect history); reservation lifecycle (reserve from CRM → hold/expiry → deposit → convert to contract) | `app/(internal)/projects/*`, `components/projects/*`, `components/units/*`, `app/actions/projects.ts`, `app/actions/units.ts`, `app/actions/reservations.ts`, `supabase/migrations/0010` | ✅ complete |
| **Buyer Portal** — first external surface: My Unit (details, floorplan, finishes, pricing, reservation/contract status), Payment Center (schedule, balance, history, receipts), Construction Progress (live milestones, photos, est. handover), Documents Center, Communication Center (direct messaging + announcements), Handover Center (checklist, warranties, manuals, title-deed) | `app/(portal)/buyer/*`, `components/buyer/*`, `app/actions/buyer.ts`, `lib/buyer.ts`, `supabase/migrations/0011` | ✅ complete |
| **Homeowner Portal** — post-handover after-sales, layered on the Buyer Portal (buyer history retained): Maintenance Center (raise tickets, photo/video upload, category/urgency, contractor assignment, live status, per-ticket messaging), Warranty Center (cover, expiry, claims), Home Documents (manuals/legal/title-deed), Property History (contract→payments→construction→handover→defects), Contractor Coordination (assigned contractor, visit schedule & history), Notifications Center (updates + warranty-expiry reminders + announcements). Buyer→homeowner activation at handover. | `app/(portal)/homeowner/*`, `components/homeowner/*`, `app/actions/maintenance.ts`, `app/actions/homeowners.ts`, `app/actions/notifications.ts`, `lib/homeowner.ts`, `supabase/migrations/0012` | ✅ complete |
| **Contractor Portal** — first-class trade access, assigned-jobs only (strict RLS): Jobs Dashboard (urgency/category/homeowner/location), Job Detail (description, photos/video, history, homeowner messaging, private internal notes), status flow (accept→start→awaiting parts→complete + completion photos), Visit Scheduling (date/time, history, homeowner notifications), Material Requests (line items + estimate + staff approval), Invoice Uploads (file→ticket linkage), Performance (completed jobs, avg resolution, rating, issue recurrence) | `app/(portal)/contractor/*`, `components/contractor/*`, `app/actions/contractor.ts`, `supabase/migrations/0013` | ✅ complete |
| **Deal Analyzer** — internal acquisitions intelligence. Land inputs (size/zoning/density/coverage/height/floors/road/green/restrictions), development analysis (buildable, units, unit mix, cost stack), financial analysis (GDV, net revenue, profit, ROI, margin, break-even, quarterly cashflow), scenario builder (compare mixes/pricing/cost strategies), risk analysis (market/permit/construction/liquidity + ±10% sensitivity), and an AI advisory layer (verdict, strengths, weaknesses, red flags, strategy, pricing). Live in-browser recompute via a pure engine; server re-computes on save. | `app/(internal)/deal-analyzer/*`, `components/deals/*`, `lib/deal-analyzer.ts`, `app/actions/deals.ts`, `lib/ai.ts` (`runDealAdvisory`), `supabase/migrations/0014` | ✅ complete |
| **Website Lead & Newsletter Sync** — public intake into the single `contacts` identity (no duplicates): contact form → contact + lead + auto follow-up task; newsletter → same identity; source tagging; all visible in CRM | `app/api/public/*`, `lib/intake.ts` | ✅ complete |
| **Financial Dashboard** — management decision metrics: cash collected, outstanding, leads/reservations/units, sales cycle & velocity, contractor liabilities, warranty/maintenance, per-project performance | `app/(internal)/financials/page.tsx`, `lib/finance.ts` | ✅ complete |
| **Automation Center** — central cross-module engine: reservation expiry, warranty expiry, payment reminders, website sync reconciliation, maintenance (visit reminders/overdue/escalation), CRM (inactive/aging/high-value), with an audit log + success/failure tracking; cron via Vercel Cron or Supabase Edge Function | `app/(internal)/automation/page.tsx`, `lib/automations.ts`, `app/api/cron/route.ts`, `supabase/functions/automations`, `vercel.json`, `supabase/migrations/0015` | ✅ complete |

## Brand system

Palette and typography are encoded as Tailwind tokens in
`tailwind.config.ts` — never hardcode a hex value in a component:

- `forest` (#1F3A30) — primary, deep dark green. Sidebar, headings, primary actions.
- `sand` (#E6DCC8) — secondary surfaces, warm beige.
- `stone` (#F7F3EC) — page background, warm off-white.
- `champagne` (#C8A86B) — the only accent color; used sparingly for active states, key figures, premium tags. Never a background fill.
- `charcoal` (#2B2A27) — primary text.

Typography: `font-display` (Source Serif 4) for every page title and project
name, across internal and external surfaces alike — `font-sans` (IBM Plex
Sans) for body/UI text, `font-mono` (IBM Plex Mono, via the `.figure`
utility class) for every number: prices, sqm, ROI%, payment amounts. This
mono-numeral treatment is the system's signature — apply `.figure` to any
financial or measurement figure you render, in every module.

Soft shadows (`shadow-soft`) and warm hairline borders (`border-stone-line`)
on resting cards — never a hard SaaS drop-shadow. Sharp-ish corners
(`rounded` = 6px) throughout, no pill buttons.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase project URL/keys, Resend key
```

Run the migrations against your Supabase project, in order:

```bash
supabase link --project-ref <your-project-ref>
supabase db push   # applies supabase/migrations/*.sql in filename order
```

Then regenerate types from the live schema (replaces the hand-authored
scaffold types in `types/database.types.ts`):

```bash
npm run supabase:types
```

Create your first admin user manually (no self-registration path exists —
by design, see Phase 3): sign up via Supabase Auth directly, then insert a
matching row into `profiles` with `role = 'admin'`.

```bash
npm run dev
```

## Key architectural decisions carried into this scaffold

- **One identity, never duplicated.** `contacts` is the single source of
  truth, matched by email via `find_or_create_contact()`. Leads, buyers,
  investors, homeowners, and newsletter subscribers all point back to one
  `contact_id`.
- **RLS is the real security boundary.** Middleware route-group checks
  (`middleware.ts`) are a UX layer on top — they redirect the wrong role
  away from a route, but even if that check were bypassed, Postgres RLS
  (migration `0007`) would still refuse the data.
- **No self-registration, anywhere.** The only way into the system as a
  buyer/investor/homeowner/contractor is `accept_invite()`, called from
  `/invite/[token]`, which links the new auth user back to an
  already-existing CRM record. Staff accounts are provisioned manually.
- **Automation suggests, staff decides.** The contractor suggestion engine
  (`suggest_contractors`) and the buyer-portal-eligible flag are both
  read-only signals — the actual assignment/activation always runs through
  an explicit Server Action a staff member triggers.
- **Roles layer, they don't replace.** A buyer's `units_buyer_read` /
  `contracts_buyer_read` access stays active even after they become a
  homeowner — nothing is revoked when a relationship evolves.

## Next steps

Foundation + CRM are complete. From here we build module by module: Deal
Analyzer, Projects/Units management, then the four portal experiences in
full, then the Automation Center's remaining Edge Functions and cron jobs.

## Continuing development in Claude Code

This project is structured so each module is additive — new tables get
their own numbered migration file (don't edit `0001`–`0009`, append
`0010_...sql` onward), new Server Actions live in their own file under
`app/actions/`, and new components get their own subfolder under
`components/`. The existing RLS policies, helper functions
(`is_staff()`, `owns_unit_as_buyer()`, etc.), and brand tokens in
`tailwind.config.ts` should be reused rather than re-derived — they're the
contract every module after this one is built against.
