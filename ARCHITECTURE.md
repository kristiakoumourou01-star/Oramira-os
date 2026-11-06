# Oramira OS — Architecture & the Client/Server Boundary

This document defines the layered architecture and the **one rule that must never
break**: a Client Component may never pull server-only code (`next/headers`) into
the browser bundle. It is enforced automatically — see [Enforcement](#enforcement).

---

## The five layers

| Layer | Where | Directive | May import | Must NOT import |
|-------|-------|-----------|------------|-----------------|
| **Shared modules** | `lib/*-shared.ts`, pure engines (`lib/land-scoring.ts`, `lib/offer-calculator.ts`, `lib/due-diligence.ts`, `lib/priority.ts`, `lib/deal-analyzer.ts`) | — | other pure modules, types | `@/lib/supabase/server`, `next/headers`, `next/server`, `server-only` |
| **Server libraries** | `lib/*.ts` (e.g. `leads.ts`, `ai.ts`, `finance.ts`, `command-center.ts`, `acquisitions.ts`) | — (server-only by dependency) | server client, other server libs, shared modules | — |
| **Server Actions** | `app/actions/*.ts` | `'use server'` | server client, server libs | — |
| **Server Components** | `app/**/page.tsx`, `app/**/layout.tsx` (default) | — | server client, server libs, actions, shared, client components (as children) | client-only browser APIs |
| **Client Components** | `components/**`, some `app/**` | `'use client'` | **shared modules**, **Server Actions**, `@/lib/supabase/client`, other client comps | `@/lib/supabase/server`, any server lib, `next/headers`, `next/server`, `server-only` |

### Why the rule exists
`lib/supabase/server.ts` imports `next/headers` (`cookies()`), which only works on
the server. If a Client Component imports it — even transitively through a server
library — Next tries to bundle `next/headers` for the browser and the **build fails**:

> You're importing a component that needs next/headers. That only works in a Server Component…

A **type-only** import (`import type { X }`) is erased by the compiler and is
technically safe, but we still forbid it: it is one careless edit away from becoming
a value import (exactly the bug that hit `AcquisitionBoard`). Keep the boundary crisp.

---

## The `*-shared.ts` split pattern

**Trigger:** a `lib/feature.ts` needs to export BOTH client-safe things (types,
constants, pure functions) AND server logic (database access). Split it:

```
lib/feature-shared.ts   ← types, constants, pure fns   (NO server imports)
lib/feature.ts          ← server fetchers; re-exports the shared surface
app/actions/feature.ts  ← 'use server' mutations
components/feature/*.tsx ← 'use client'; imports from feature-shared + actions/feature
```

- **Server code** (`lib/feature.ts`) `export`s the shared types so existing server
  importers don't change their import path.
- **Client code** imports those types/constants from `@/lib/feature-shared`.

Copy-paste starters live in [`docs/templates/`](docs/templates/):
`feature-shared.ts.example`, `feature.ts.example`, `Board.tsx.example`.

### Live examples in this codebase
| Shared (client-safe) | Server library |
|----------------------|----------------|
| `lib/acquisitions-shared.ts` (`PARCEL_STAGES`, `STAGE_LABEL`, `STAGE_COLOR`, `ParcelItem`) | `lib/acquisitions.ts` (`getParcels`) |
| `lib/leads-shared.ts` (`LeadListItem`) | `lib/leads.ts` (`getEnrichedLeads`) |
| `lib/ai-shared.ts` (`DealAdvisory`, `DraftIntent`, `DraftedMessage`) | `lib/ai.ts` |
| `lib/command-center-shared.ts` (`CommandCenter`, `PriorityModule`, …) | `lib/command-center.ts` (`buildCommandCenter`) |
| `lib/storage-shared.ts` (`BUCKETS`, `BucketName`) | `lib/storage.ts` |
| `lib/project-media-shared.ts` (`SignedMedia`) | `lib/project-media.ts` |

**Server Actions are a legitimate boundary** — a Client Component importing
`@/app/actions/*` is correct; Next turns it into an RPC reference (not bundled).
Pure engines with no `supabase/server` import (`land-scoring`, `offer-calculator`,
`due-diligence`, `deal-analyzer`, `priority`) are import-safe from anywhere.

---

## Enforcement

1. **CI guard (authoritative):** `scripts/check-client-boundary.mjs` computes the
   transitive taint closure from `next/headers`/`supabase/server` and fails if any
   `'use client'` file reaches a server module. It runs automatically on every
   build via the `prebuild` npm script, and can be run directly:
   ```
   npm run check:boundary
   ```
2. **ESLint (`.eslintrc.json`):** forbids `components/**` from importing
   `next/headers`, `next/server`, `server-only`, `@/lib/supabase/server`,
   `@/lib/supabase/middleware` directly.
3. **`tsc --noEmit`:** the type check of record (no `next build` while the dev
   server is running — they collide on `.next`).

If the guard fails, it tells you the offending file and import. The fix is always
the same: move the client-safe part into a `*-shared.ts` module and import from there.
