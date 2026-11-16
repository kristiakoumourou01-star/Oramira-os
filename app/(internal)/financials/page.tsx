import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getFinanceSnapshot } from '@/lib/finance';
import { buildFinancialForecast } from '@/lib/financial-forecast';
import { ForecastPanel } from '@/components/financials/ForecastPanel';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { HubLinks } from '@/components/ui/HubTabs';
import { eur } from '@/lib/deal-analyzer';
import { TrendingUp, Wallet, Hourglass, Wrench, Users, CalendarCheck, Home, KeyRound, Timer, Gauge, ShieldCheck, Hammer, Building2 } from 'lucide-react';

type Tone = 'green' | 'amber' | 'forest' | 'rose' | 'sky' | 'violet' | 'sand';
// Ένα χρώμα παντού (της εταιρείας), όπως στο FitnessCRM.
const ONE = { card: 'from-white to-white border-stone-line', ico: 'bg-forest/[0.09] text-forest', val: 'text-charcoal' };
const TONE: Record<Tone, { card: string; ico: string; val: string }> = { green: ONE, amber: ONE, forest: ONE, rose: ONE, sky: ONE, violet: ONE, sand: ONE };

// Κύριος αριθμός (χρήματα): έγχρωμη κάρτα με εικονίδιο.
function Stat({ label, value, icon: Icon, hint, tone }: { label: string; value: string; icon: any; hint?: string; tone: Tone }) {
  const t = TONE[tone];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-[0_1px_2px_rgba(17,49,36,0.04)] ${t.card}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${t.ico}`}><Icon size={17} strokeWidth={2} /></span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70">{label}</p>
      </div>
      <p className={`mt-3 font-display text-[30px] leading-none ${t.val}`}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-charcoal-600/65">{hint}</p>}
    </div>
  );
}

// Δευτερεύων αριθμός: μικρό πλακίδιο με χρωματιστό εικονίδιο.
function Metric({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: any; tone: Tone }) {
  const t = TONE[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-inset ring-stone-line/70">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.ico} opacity-90`}><Icon size={16} strokeWidth={2} /></span>
      <div className="min-w-0">
        <p className={`text-lg font-semibold leading-none ${t.val}`}>{value}</p>
        <p className="mt-1 truncate text-[11px] font-medium text-charcoal-600/70">{label}</p>
        {hint && <p className="truncate text-[10px] text-charcoal-600/50">{hint}</p>}
      </div>
    </div>
  );
}

const Bar = ({ pct, cls }: { pct: number; cls: string }) => (
  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone"><div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
);

export default async function FinancialsPage() {
  await requirePermission('financials');
  const supabase = await createSupabaseServerClient();
  const [f, forecast] = await Promise.all([getFinanceSnapshot(), buildFinancialForecast(supabase)]);
  const maintenanceTotal = f.maintenanceOpen + f.maintenanceClosed;
  const closedPct = maintenanceTotal > 0 ? Math.round((f.maintenanceClosed / maintenanceTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Οικονομικά" title="Οικονομικά" description="Εισπράξεις, υπόλοιπα, συμβόλαια και απόδοση ανά έργο, ζωντανά." />
      <HubLinks cols={3} active="overview" cards={[
        { key: 'overview', icon: 'Wallet', title: 'Επισκόπηση', value: eur(f.cashCollected, { compact: true }), sub: 'Εισπράξεις μέχρι σήμερα', href: '/financials' },
        { key: 'invoices', icon: 'Receipt', title: 'Τιμολόγια', sub: 'Τιμολόγια, αποδείξεις, πιστωτικά', href: '/financials/invoices' },
        { key: 'reports', icon: 'BarChart3', title: 'Αναφορές', sub: 'Έτοιμες και δικές σας αναφορές', href: '/reports' },
      ]} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat tone="green" label="Εισπράξεις" value={eur(f.cashCollected, { compact: true })} icon={Wallet} hint="Εισπράξεις μέχρι σήμερα" />
        <Stat tone="amber" label="Υπόλοιπο προς είσπραξη" value={eur(f.outstandingBalance, { compact: true })} icon={Hourglass} hint="Υπογεγραμμένα, απλήρωτα" />
        <Stat tone="forest" label="Έσοδα συμβολαίων" value={eur(f.totalRevenue, { compact: true })} icon={TrendingUp} hint="Σύνολο υπογεγραμμένων συμβολαίων" />
        <Stat tone="rose" label="Υποχρεώσεις σε εργολάβους" value={eur(f.contractorLiabilities, { compact: true })} icon={Wrench} hint="Υποβληθέντα και εγκεκριμένα τιμολόγια" />
      </div>

      <div className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-forest"><span className="h-4 w-1 rounded-full bg-forest" /> Πωλήσεις & λειτουργία</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric tone="sky" icon={Users} label="Ενεργά leads" value={String(f.activeLeads)} />
          <Metric tone="amber" icon={CalendarCheck} label="Κρατήσεις" value={String(f.activeReservations)} />
          <Metric tone="green" icon={KeyRound} label="Πωλημένες μονάδες" value={String(f.soldUnits)} />
          <Metric tone="forest" icon={Home} label="Διαθέσιμες" value={String(f.availableUnits)} />
          <Metric tone="violet" icon={Timer} label="Κύκλος πώλησης" value={f.avgSalesCycleDays != null ? `${f.avgSalesCycleDays} μ.` : '—'} hint="lead → κράτηση" />
          <Metric tone="sky" icon={Gauge} label="Ρυθμός 90 ημερών" value={String(f.reservationsLast90)} hint={`~${(f.reservationsLast90 / 3).toFixed(1)}/μήνα`} />
          <Metric tone="sand" icon={ShieldCheck} label="Αιτήματα εγγύησης" value={String(f.warrantyClaims)} />
          <Metric tone={f.maintenanceOpen ? 'rose' : 'green'} icon={Hammer} label="Συντήρηση: κλειστά" value={`${closedPct}%`} hint={`${f.maintenanceOpen} ανοιχτά`} />
        </div>
      </div>

      <ForecastPanel forecast={forecast} />

      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <div className="flex items-center gap-2.5 border-b border-stone-line px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest/[0.09] text-forest"><Building2 size={15} /></span>
          <h4 className="text-[15px] font-semibold text-charcoal">Απόδοση ανά έργο</h4>
        </div>
        {f.projects.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-charcoal-600/70">Δεν υπάρχουν ακόμη έργα.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="o-table">
              <thead>
                <tr><th>Έργο</th><th>Μονάδες (πωλ. / σύνολο)</th><th>Έσοδα</th><th>Εισπράχθηκαν</th><th>Κόστος εργολάβων</th><th className="text-right">Καθαρή συνεισφορά</th></tr>
              </thead>
              <tbody>
                {f.projects.map((p) => {
                  const collectedPct = p.revenue > 0 ? Math.round((p.collected / p.revenue) * 100) : 0;
                  const soldPct = p.totalUnits > 0 ? Math.round((p.soldUnits / p.totalUnits) * 100) : 0;
                  return (
                    <tr key={p.projectId}>
                      <td className="o-strong" data-no-tr>{p.name}<span className="block text-[11px] font-normal text-charcoal-600">{p.availableUnits} διαθέσιμες</span></td>
                      <td className="w-44"><span className="figure text-charcoal">{p.soldUnits} / {p.totalUnits}</span> <span className="text-xs text-charcoal-600/60">{soldPct}%</span><Bar pct={soldPct} cls="bg-forest" /></td>
                      <td className="figure font-medium text-charcoal">{eur(p.revenue, { compact: true })}</td>
                      <td className="w-44"><span className="figure text-forest">{eur(p.collected, { compact: true })}</span> <span className="text-xs text-charcoal-600/60">{collectedPct}%</span><Bar pct={collectedPct} cls="bg-forest" /></td>
                      <td className="figure text-charcoal">{eur(p.contractorLiabilities, { compact: true })}</td>
                      <td className="text-right"><span className={`figure inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${p.contribution >= 0 ? 'bg-forest/[0.06] text-forest ring-1 ring-inset ring-forest/25' : 'bg-rose-50 text-signal-danger ring-1 ring-inset ring-rose-200'}`}>{eur(p.contribution, { compact: true })}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-charcoal-600/50">
        Διοικητική εικόνα: ενδεικτικά νούμερα για αποφάσεις, όχι λογιστικό βιβλίο. «Καθαρή συνεισφορά» = έσοδα συμβολαίων μείον ανοιχτές υποχρεώσεις σε εργολάβους.
      </p>
    </div>
  );
}
