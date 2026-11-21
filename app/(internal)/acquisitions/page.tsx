import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { getParcels, STAGE_LABEL } from '@/lib/acquisitions';
import { detectAssembly } from '@/lib/land-assembly';
import { HubTabs, type HubTabDef } from '@/components/ui/HubTabs';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { AcquisitionMap } from '@/components/acquisitions/AcquisitionMap';
import { AcquisitionBoard } from '@/components/acquisitions/AcquisitionBoard';
import { NewParcelForm } from '@/components/acquisitions/NewParcelForm';
import { AssemblyPanel } from '@/components/acquisitions/AssemblyPanel';
import { Phone, MessageCircle, Mail } from 'lucide-react';
import { parcelProjects } from '@/lib/project-flow';
import { formatCurrency } from '@/lib/format';

const DAY = 86400000;
const BAND: Record<string, string> = { Prime: 'bg-forest text-white', Strong: 'bg-forest/12 text-forest', Moderate: 'bg-champagne-50 text-champagne-600', Weak: 'bg-sand-100 text-charcoal-600/70' };
const Panel = ({ children }: { children: React.ReactNode }) => <div className="panel p-6">{children}</div>;

export default async function AcquisitionsPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requirePermission('acquisitions');
  const supabase = await createSupabaseServerClient();
  const now = Date.now();

  const [parcels, { data: agents }, converted] = await Promise.all([
    getParcels(),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).order('full_name'),
    parcelProjects(),
  ]);

  const clusters = detectAssembly(parcels.map((p) => ({ id: p.id, reference: p.reference, areaRef: p.areaRef, plotSizeSqm: p.plotSizeSqm, stage: p.stage, ownerName: p.ownerName, score: p.score.score, marginAbs: p.uplift?.marginAbs ?? 0 })));

  const active = parcels.filter((p) => !['acquired', 'lost'].includes(p.stage));
  const acquired = parcels.filter((p) => p.stage === 'acquired').length;

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

  const outreachDue = active.filter((p) => ['contacted', 'interested', 'negotiation'].includes(p.stage) && (!p.lastContactedAt || now - new Date(p.lastContactedAt).getTime() > 7 * DAY)).sort((a, b) => b.score.score - a.score.score);

  const tabs: HubTabDef[] = [
    { id: 'map', label: 'Χάρτης', icon: 'Map', value: parcels.length, sub: 'Όλα τα οικόπεδα στον χάρτη', content: <AcquisitionMap parcels={parcels} /> },
    { id: 'pipeline', label: 'Pipeline', icon: 'Columns', value: active.length, sub: `${acquired} αποκτήθηκαν`, content: parcels.length === 0 ? <Panel><p className="text-sm text-charcoal-600/70">Δεν υπάρχουν ακόμη οικόπεδα. Προσθέστε τον πρώτο ιδιοκτήτη γης για να ξεκινήσετε.</p></Panel> : <AcquisitionBoard parcels={parcels} projects={converted} /> },
    {
      id: 'scoring', label: 'Αξιολόγηση γης', icon: 'Gauge', value: avg(active.map((p) => p.score.score)), sub: 'Μέσο σκορ ενεργών', content: (
        <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {parcels.length === 0 ? <p className="p-6 text-sm text-charcoal-600/70">Δεν έχουν αξιολογηθεί οικόπεδα ακόμη.</p> : (
            <div className="overflow-x-auto">
              <table className="o-table">
                <thead><tr><th>Οικόπεδο</th><th>Ιδιοκτήτης</th><th>Τοποθεσία</th><th>Στάδιο</th><th className="text-right">Ετοιμότητα</th><th className="text-right">Υπεραξία</th><th className="text-right">Σκορ</th><th>Έργο</th></tr></thead>
                <tbody>
                  {parcels.map((p) => (
                    <tr key={p.id}>
                      <td className="o-strong" data-no-tr><Link href={`/acquisitions/${p.id}`} className="hover:text-forest">{p.reference}</Link></td>
                      <td data-no-tr>{p.ownerName ?? '—'}</td>
                      <td data-no-tr><span className="block max-w-[160px] truncate">{p.location ?? '—'}</span></td>
                      <td>{STAGE_LABEL[p.stage]}</td>
                      <td className="text-right tabular-nums">{p.readiness.score}</td>
                      <td className="text-right tabular-nums">{p.uplift ? formatCurrency(p.uplift.marginAbs) : '—'}</td>
                      <td className="text-right"><span className={`figure rounded-md px-2 py-0.5 text-xs font-semibold ${BAND[p.score.band]}`}>{p.score.score}</span></td>
                      <td>{converted[p.id] ? <Link href={`/projects/${converted[p.id]}`} className="text-forest hover:underline">Άνοιγμα έργου</Link> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ),
    },
    { id: 'assembly', label: 'Συνένωση', icon: 'Puzzle', value: clusters.length, sub: 'Γειτονικά οικόπεδα για ένωση', content: <AssemblyPanel clusters={clusters} /> },
    {
      id: 'outreach', label: 'Επαφές ιδιοκτητών', icon: 'PhoneCall', value: outreachDue.length, sub: 'Χρειάζονται επικοινωνία', content: (
        <div className="space-y-4">
          <Panel>
            <h4 className="mb-1 text-charcoal">Αυτόματη επικοινωνία</h4>
            <p className="mb-3 text-xs text-charcoal-600/60">Ο αυτοματισμός υπενθυμίζει στους ιδιοκτήτες που δεν έχουν απαντήσει (πρώτα WhatsApp, μετά email) και σημειώνει πότε χρειάζεται τηλεφώνημα. Follow-ups, προθεσμίες ελέγχου και κολλημένες διαπραγματεύσεις τρέχουν αυτόματα.</p>
            <div className="flex flex-wrap gap-2 text-xs text-charcoal-600/70">
              <span className="flex items-center gap-1 rounded-lg bg-sand-100 px-2.5 py-1"><Phone size={12} className="text-forest" /> Κλήση</span>
              <span className="flex items-center gap-1 rounded-lg bg-sand-100 px-2.5 py-1"><MessageCircle size={12} className="text-forest" /> WhatsApp</span>
              <span className="flex items-center gap-1 rounded-lg bg-sand-100 px-2.5 py-1"><Mail size={12} className="text-forest" /> Email</span>
            </div>
          </Panel>
          <Panel>
            <h4 className="mb-3 text-charcoal">Χρειάζονται επικοινωνία · {outreachDue.length}</h4>
            {outreachDue.length === 0 ? <p className="text-sm text-charcoal-600/60">Όλοι οι ενεργοί ιδιοκτήτες έχουν ενημερωθεί πρόσφατα.</p> : (
              <ul className="divide-y divide-stone-line">
                {outreachDue.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0"><Link href={`/acquisitions/${p.id}`} className="font-medium text-charcoal hover:text-forest">{p.reference}</Link><span className="text-[11px] text-charcoal-600/55">{p.ownerName ? ` · ${p.ownerName}` : ''} · {STAGE_LABEL[p.stage]}</span></div>
                    <span className="shrink-0 text-[11px] text-signal-danger">{p.lastContactedAt ? `${Math.floor((now - new Date(p.lastContactedAt).getTime()) / DAY)} μέρες χωρίς επαφή` : 'καμία επαφή ακόμη'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Έργα" title="Αγορές γης" description="Οικόπεδο → Deal Analyzer → Έργο. Εντοπισμός, ανάλυση και διαπραγμάτευση οικοπέδων, με μετατροπή σε έργο σε οποιοδήποτε στάδιο." action={<NewParcelForm agents={(agents ?? []) as any} />} />

      {/* Χάρτης / Pipeline / Αξιολόγηση / Συνένωση / Επαφές — αμέσως κάτω από τους αριθμούς */}
      <HubTabs tabs={tabs} initial={searchParams?.tab ?? 'pipeline'} cols={3} />
    </div>
  );
}
