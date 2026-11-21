# Oramira OS — κανόνες για κάθε agent

Διάβασε αυτό πριν αλλάξεις οτιδήποτε. Ισχύει για όλους τους agents που δουλεύουν στο repo.

## Επικοινωνία
- Απαντάς πάντα στα **ελληνικά**, απλά και σύντομα (η ιδιοκτήτρια δεν είναι προγραμματίστρια).
- Λες τι άλλαξε με λόγια χρήστη ("η σελίδα Πελάτες δείχνει τώρα…"), όχι ονόματα αρχείων.

## Στόχος εμφάνισης
- Η εφαρμογή πρέπει να μοιάζει **ακριβώς με το FitnessCRM** (fitness.thinkcrm.com) σε layout, γραμματοσειρές, πίνακες, κινήσεις — με δεδομένα real estate.
- **Ένα χρώμα έμφασης**: το χρώμα της εταιρείας από τις Ρυθμίσεις (Tailwind `forest`, CSS `rgb(var(--c-forest))`). Όπου το FitnessCRM έχει μωβ, εδώ μπαίνει `forest`. Ποτέ hardcoded χρώματα.
- Κάθε **επιλεγμένο** στοιχείο (sidebar, κάρτες, chips, segmented) είναι γεμάτο: `bg-forest text-white`.
- **Πουθενά** δεν εμφανίζεται "ThinkCRM" ή "FitnessCRM".
- Πίνακες: κλάση `o-table`, μέσα σε `overflow-x-auto`, σελιδοποίηση με `Pager` (10/25/50/100 γραμμές). Ποτέ οριζόντιο overflow της σελίδας.
- Έτοιμα κομμάτια UI (χρησιμοποίησέ τα, μη φτιάχνεις καινούρια): `HubCards`, `HubLinks`, `HubTabs` (εικονίδια με όνομα από το `ICONS` στο `HubTabs.tsx`), `PopSelect`, `Pager`, `Briefing`, `SideStat`, `SettingsFrame`, `MobileNav`.
- Πρέπει να δουλεύει σε κινητό (από 360px πλάτος).

## Μετάφραση (EL / EN / RU)
- Τα κείμενα γράφονται **στα ελληνικά** στον κώδικα. Το `components/i18n/DomTranslator.tsx` τα μεταφράζει στη σελίδα.
- Κάθε νέο ελληνικό κείμενο → πρόσθεσε μετάφραση **και** στο `lib/i18n-dict/en.ts` **και** στο `lib/i18n-dict/ru.ts` (ίδιο κλειδί, ίδιος αριθμός `{}` για μεταβλητές).
- Αν γράψεις κείμενο στα αγγλικά → πρόσθεσέ το στο `lib/i18n-dict/from-en.ts` (`EN_EL` και `EN_RU`).
- Μην ενώνεις πολλές φράσεις σε ένα string (`[...].join(' · ')`): βάλε κάθε φράση στο δικό της `<span>`.
- Δεδομένα χρηστών (ονόματα, διευθύνσεις) τυλίγονται σε `data-no-tr`. Ελληνικές ετικέτες **δεν** μπαίνουν μέσα σε `data-no-tr`.
- Ημερομηνίες: `DATE_TAG[currentLocale().lang]` από `lib/locale-shared`, ποτέ σκέτο `'el-GR'`.

## Κώδικας
- Next.js 14 App Router, Supabase, Vercel.
- Components **δεν** κάνουν import το `@/lib/supabase/server`. Η φόρτωση δεδομένων γίνεται σε `lib/*.ts`.
- Client components δεν κάνουν import server libs. Τα κοινά πάνε σε `lib/*-shared.ts`.
- Αλλαγές βάσης: νέο αρχείο στο `supabase/migrations/` με τον επόμενο αριθμό. **Ενημέρωσε τον integrator πριν το εφαρμόσεις**, για να μην πάρουν δύο agents τον ίδιο αριθμό.
- Πριν από κάθε commit τρέξε:
  - `npx tsc --noEmit -p .` (μετά `git checkout tsconfig.tsbuildinfo`)
  - `npx next lint --dir <φάκελοι που άλλαξες>`
  - `node scripts/check-client-boundary.mjs`

## Ασφάλεια
- Ποτέ μην διαβάζεις ή τυπώνεις μυστικά (`.env*`, κλειδιά, tokens). Ποτέ μην βάζεις κωδικούς σε φόρμες· η χρήστρια συνδέεται μόνη της.
- Μην αλλάζεις ρυθμίσεις Vercel / DNS / domain χωρίς ρητή άδεια. (Το app.oramiraltd.com το αναλαμβάνει αργότερα ο προγραμματιστής.)
- Στο FitnessCRM μόνο **κοιτάς**· ποτέ δεν αλλάζεις τίποτα εκεί.

## Ομάδα agents & branches
Κάθε agent δουλεύει **μόνο στην περιοχή του** και στο **δικό του branch** (από το `steps-11-14`). Αν χρειαστεί αλλαγή εκτός περιοχής, το λέει στον integrator αντί να την κάνει.

| Agent | Branch | Περιοχή (φάκελοι) |
|---|---|---|
| **Integrator** (κύρια συνομιλία) | `steps-11-14` → `main` | Κοινά αρχεία: `components/layout`, `components/ui`, `components/i18n`, `lib/i18n-dict`, `app/globals.css`, `tailwind.config.ts`, `middleware.ts`, migrations. Ενώνει τα branches, ελέγχει, ανεβάζει. |
| **Sales & CRM** | `agent-sales` | `app/(internal)/sales`, `crm`, `dashboard`, `command-center`, `components/sales`, `crm`, `deals`, `dashboard` |
| **Projects & Property** | `agent-projects` | `projects`, `property`, `acquisitions`, `deal-analyzer`, `map`, `components/projects`, `property`, `units`, `construction`, `acquisitions`, `map`, `pricing` |
| **Finance & Reports** | `agent-finance` | `financials`, `reports`, `components/financials`, `reports`, `contractor` |
| **Staff & HR** | `agent-hr` | `hr`, `tasks`, `calendar`, `settings/users`, `components/hr`, `tasks`, `calendar`, `admin/Employees*`, `admin/Users*` |
| **Marketing & App** | `agent-marketing` | `marketing`, `automation`, `benefits`, portals (`buyer`, `homeowner`, `portal`, `booking`), `components/marketing`, `comms`, `automation` |
| **Settings & Account** | `agent-settings` | `settings` (εκτός users), `account`, `components/admin` (εκτός Employees/Users), `auth` |

**Ροή:**
1. Ο agent ξεκινά: `git fetch && git checkout -B agent-xxx origin/steps-11-14`.
2. Κάνει τις αλλαγές του και τους ελέγχους, κάνει commit και `git push origin agent-xxx`.
3. Λέει στον integrator «έτοιμο». Ο integrator ενώνει στο `steps-11-14`, ελέγχει το preview, και μετά από έγκριση ανεβάζει στο `main` (production) μέσω PR.
4. Πριν ξεκινήσει νέα δουλειά, ο agent ξαναπαίρνει το `steps-11-14` (`git rebase origin/steps-11-14`).

Τα κοινά αρχεία μετάφρασης (`en.ts`, `ru.ts`, `from-en.ts`) αλλάζουν συχνά. Πρόσθετε μόνο **στο τέλος** του αρχείου (πριν το `};`), για να ενώνονται εύκολα.
