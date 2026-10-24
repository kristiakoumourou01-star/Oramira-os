import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, Mail, MapPin, Ruler, Flag, HeartHandshake } from 'lucide-react';
import { getParcel, STAGE_LABEL } from '@/lib/acquisitions';
import { LandScorePanel } from '@/components/acquisitions/LandScorePanel';
import { ParcelEditor } from '@/components/acquisitions/ParcelEditor';
import { ParcelOutreach } from '@/components/acquisitions/ParcelOutreach';
import { DueDiligencePanel } from '@/components/acquisitions/DueDiligencePanel';
import { DocumentVault, type ParcelDoc } from '@/components/acquisitions/DocumentVault';
import { OfferCalculator } from '@/components/acquisitions/OfferCalculator';
import { ParcelTimeline, type TimelineEntry } from '@/components/acquisitions/ParcelTimeline';
import { formatNumber, formatCurrency } from '@/lib/format';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const Panel = ({ children }: { children: React.ReactNode }) => <div className="panel p-6">{children}</div>;
const READY: Record<string, string> = { Ready: 'bg-forest text-white', Warming: 'bg-champagne-50 text-champagne-600', Early: 'bg-sand-100 text-charcoal-600/70' };

export default async function ParcelDetailPage({ params }: { params: { id: string } }) {
  await requirePermission('acquisitions');
  const parcel = await getParcel(params.id);
  if (!parcel) notFound();
  const supabase = await createSupabaseServerClient();

  const [commsRes, docsRes, activityRes] = await Promise.all([
    parcel.contactId ? supabase.from('contact_communications').select('id, channel, direction, summary, occurred_at').eq('contact_id', parcel.contactId).order('occurred_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] as any[] }),
    supabase.from('parcel_documents').select('id, category, name, url, note, created_at').eq('parcel_id', parcel.id).order('created_at', { ascending: false }),
    supabase.from('activity_log').select('id, action, metadata, created_at').eq('entity_type', 'land_parcel').eq('entity_id', parcel.id).order('created_at', { ascending: false }).limit(50),
  ]);
  const comms = commsRes.data ?? [];
  const docs = (docsRes.data ?? []) as ParcelDoc[];
  const activity = activityRes.data ?? [];

  const timeline: TimelineEntry[] = [
    ...comms.map((c: any) => ({ id: `c_${c.id}`, at: c.occurred_at, kind: c.channel, title: `${cap(c.channel)} · ${c.direction}`, detail: c.summary })),
    ...docs.map((d) => ({ id: `d_${d.id}`, at: d.created_at, kind: 'document', title: `Document — ${d.name}`, detail: d.category.replace('_', ' ') })),
    ...activity.filter((a: any) => a.action === 'stage_changed' || a.action === 'due_diligence_updated').map((a: any) => ({
      id: `a_${a.id}`, at: a.created_at, kind: 'stage',
      title: a.action === 'stage_changed' ? `Moved to ${STAGE_LABEL[a.metadata?.stage] ?? a.metadata?.stage}` : `DD · ${(a.metadata?.key ?? '').replace(/_/g, ' ')} ${a.metadata?.done ? '✓' : '✗'}`,
      detail: null,
    })),
  ];

  const sellerTags = [parcel.financialPressure && 'Financial pressure', parcel.debtPressure && 'Debt pressure', parcel.inheritance && 'Inheritance', parcel.familySplit && 'Family dispute', parcel.divorce && 'Divorce', parcel.relocation && 'Relocation'].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <Link href="/acquisitions" className="inline-flex items-center gap-1.5 text-sm text-charcoal-600/70 hover:text-forest"><ArrowLeft size={15} /> Acquisitions</Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl">{parcel.reference}</h1>
            <span className="rounded-full bg-forest/8 px-2.5 py-1 text-xs font-medium text-forest">{STAGE_LABEL[parcel.stage] ?? parcel.stage}</span>
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${READY[parcel.readiness.label]}`}><HeartHandshake size={12} /> {parcel.readiness.label} · {parcel.readiness.score}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-charcoal-600/70">
            {parcel.location && <span className="flex items-center gap-1"><MapPin size={13} /> {parcel.location}</span>}
            {parcel.plotSizeSqm && <span className="flex items-center gap-1"><Ruler size={13} /> {formatNumber(Number(parcel.plotSizeSqm))}m²</span>}
            {parcel.areaRef && <span className="flex items-center gap-1"><Flag size={13} /> {parcel.areaRef}</span>}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium text-charcoal">{parcel.ownerName ?? 'Owner unknown'}</p>
          <div className="mt-0.5 flex justify-end gap-3 text-charcoal-600/70">
            {parcel.ownerPhone && <a href={`tel:${parcel.ownerPhone}`} className="flex items-center gap-1 hover:text-forest"><Phone size={12} /> {parcel.ownerPhone}</a>}
            {parcel.ownerEmail && !parcel.ownerEmail.endsWith('@parcel.oramira.local') && <a href={`mailto:${parcel.ownerEmail}`} className="flex items-center gap-1 hover:text-forest"><Mail size={12} /> Email</a>}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left — score + seller + DD */}
        <div className="space-y-5">
          <LandScorePanel score={parcel.score} uplift={parcel.uplift} />
          <Panel>
            <h4 className="mb-3 text-charcoal">Seller intelligence</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-charcoal-600/70">Readiness</dt><dd className="figure text-champagne-600">{parcel.readiness.score}<span className="text-charcoal-600/40">/100</span></dd></div>
              <div className="flex justify-between"><dt className="text-charcoal-600/70">Urgency / Flexibility</dt><dd className="figure text-charcoal">{parcel.sellerUrgency ?? '—'} / {parcel.flexibility ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-charcoal-600/70">Timeline</dt><dd className="text-right capitalize text-charcoal">{parcel.timelineToSell?.replace('_', ' ') ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-charcoal-600/70">Reason</dt><dd className="text-right text-charcoal">{parcel.reasonForSelling ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-charcoal-600/70">Asking / Offer</dt><dd className="figure text-charcoal">{formatCurrency(parcel.askingPrice)} / {formatCurrency(parcel.offerAmount)}</dd></div>
            </dl>
            {sellerTags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{sellerTags.map((t) => <span key={t} className="rounded bg-champagne-50 px-1.5 py-0.5 text-[10px] text-champagne-600">{t}</span>)}</div>}
          </Panel>
          <DueDiligencePanel parcelId={parcel.id} dd={parcel.dd} />
        </div>

        {/* Right — offer, editor, docs, timeline, outreach */}
        <div className="space-y-5 lg:col-span-2">
          <OfferCalculator parcelId={parcel.id} initial={parcel.offerInputs} />
          <ParcelEditor parcel={parcel} />
          <DocumentVault parcelId={parcel.id} docs={docs} />
          <ParcelTimeline entries={timeline} />
          <ParcelOutreach parcelId={parcel.id} contactId={parcel.contactId} />
        </div>
      </div>
    </div>
  );
}
