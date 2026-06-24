import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBuyerUnit } from '@/lib/buyer';
import Link from 'next/link';
import { Building2, Wallet, HardHat, KeyRound, FileText, MessageSquare, ArrowRight, Megaphone } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { UnitStatusBadge } from '@/components/units/UnitStatusBadge';

export default async function BuyerOverviewPage() {
  const profile = await requireRole(['buyer', 'admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  const unit = await getBuyerUnit(profile.contactId);

  if (!unit) {
    return (
      <div className="space-y-8">
        <div>
          <p className="eyebrow mb-1">Welcome to Oramira</p>
          <h1 className="font-display text-3xl">Hello{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}</h1>
        </div>
        <EmptyState
          icon={Building2}
          title="Your home is being prepared"
          description="As soon as your reservation is confirmed, your unit, payment plan, and live construction progress will appear here."
        />
      </div>
    );
  }

  const [{ data: payments }, { data: milestones }, { data: announcement }] = await Promise.all([
    unit.contract
      ? supabase.from('payments').select('amount_paid').eq('contract_id', unit.contract.id)
      : Promise.resolve({ data: [] as { amount_paid: number }[] }),
    supabase.from('project_milestones').select('id, status').eq('project_id', unit.project_id),
    supabase
      .from('announcements')
      .select('id, title, body, published_at')
      .or(`project_id.is.null,project_id.eq.${unit.project_id}`)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const total = unit.contract?.total_price ?? unit.price ?? null;
  const payPct = total && total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const ms = milestones ?? [];
  const constructionPct = ms.length > 0 ? Math.round((ms.filter((m) => m.status === 'complete').length / ms.length) * 100) : 0;

  const tiles = [
    { href: '/buyer/my-unit', label: 'My Unit', icon: Building2, hint: 'Details, floorplan & specs' },
    { href: '/buyer/payments', label: 'Payment Center', icon: Wallet, hint: `${payPct}% paid` },
    { href: '/buyer/construction', label: 'Construction', icon: HardHat, hint: `${constructionPct}% complete` },
    { href: '/buyer/documents', label: 'Documents', icon: FileText, hint: 'Contracts & legal' },
    { href: '/buyer/messages', label: 'Messages', icon: MessageSquare, hint: 'Your Oramira team' },
    { href: '/buyer/handover', label: 'Handover', icon: KeyRound, hint: 'Checklist & warranties' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Welcome back</p>
        <h1 className="font-display text-3xl">Hello{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}</h1>
      </div>

      {/* Unit hero — the one warm, premium statement of the portal */}
      <Link href="/buyer/my-unit" className="group block overflow-hidden rounded-md bg-forest text-stone-100 shadow-soft">
        <div className="flex items-center justify-between p-8">
          <div>
            <p className="text-[11px] uppercase tracking-eyebrow text-champagne">{unit.project_name}{unit.project_location ? ` · ${unit.project_location}` : ''}</p>
            <h2 className="mt-1 font-display text-3xl text-stone-100">Unit {unit.unit_number}</h2>
            <p className="mt-2 text-sm text-stone-100/70">
              {[unit.type, unit.building_name, unit.bedrooms != null ? `${unit.bedrooms} bed` : null, unit.sqm != null ? `${unit.sqm} m²` : null]
                .filter(Boolean)
                .join('  ·  ')}
            </p>
          </div>
          <div className="text-right">
            <UnitStatusBadge status={unit.status} />
            {total != null && <p className="figure mt-3 text-2xl text-champagne">€{Number(total).toLocaleString()}</p>}
            <span className="mt-3 inline-flex items-center gap-1 text-sm text-stone-100/70 transition-colors group-hover:text-champagne">
              View my unit <ArrowRight size={14} strokeWidth={1.75} />
            </span>
          </div>
        </div>
      </Link>

      {/* Two headline progress meters */}
      <div className="grid grid-cols-2 gap-6">
        <div className="panel p-6">
          <p className="eyebrow mb-3">Payment progress</p>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="figure text-2xl text-forest">€{paid.toLocaleString()}</span>
            {total != null && <span className="figure text-sm text-charcoal-600/70">of €{Number(total).toLocaleString()}</span>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sand-100"><div className="h-full rounded-full bg-forest" style={{ width: `${payPct}%` }} /></div>
        </div>
        <div className="panel p-6">
          <p className="eyebrow mb-3">Construction progress</p>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="figure text-2xl text-forest">{constructionPct}%</span>
            <span className="text-sm text-charcoal-600/70">{unit.handover_date ? `Handover ${new Date(unit.handover_date).toLocaleDateString()}` : 'Handover TBC'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sand-100"><div className="h-full rounded-full bg-forest" style={{ width: `${constructionPct}%` }} /></div>
        </div>
      </div>

      {announcement && (
        <Link href="/buyer/messages" className="panel flex items-start gap-3 p-5 transition-shadow hover:shadow-overlay">
          <Megaphone size={18} className="mt-0.5 shrink-0 text-champagne-600" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-medium text-charcoal">{announcement.title}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-charcoal-600/80">{announcement.body}</p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="panel flex items-center gap-4 p-5 transition-shadow hover:shadow-overlay">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-100 text-forest">
              <t.icon size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-charcoal">{t.label}</p>
              <p className="text-xs text-charcoal-600/60">{t.hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
