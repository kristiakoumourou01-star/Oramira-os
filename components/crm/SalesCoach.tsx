import { recommendForLead, speedTier, callStrategy, type LeadSignals } from '@/lib/sales-doctrine';
import { Phone, MessageCircle, Mail, RefreshCcw, Heart, Clock } from 'lucide-react';

const TEMP: Record<string, { label: string; cls: string }> = {
  hot: { label: 'Hot', cls: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge' },
  warm: { label: 'Warm', cls: 'badge-champagne' },
  cold: { label: 'Cold', cls: 'badge-neutral' },
};
const URGENCY: Record<string, string> = {
  critical: 'text-signal-danger', high: 'text-signal-warning', normal: 'text-charcoal-600', low: 'text-charcoal-600/60',
};
const REC = {
  call: { icon: Phone, label: 'Call' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp' },
  email: { icon: Mail, label: 'Email' },
  nurture: { icon: Heart, label: 'Nurture' },
  retarget: { icon: RefreshCcw, label: 'Retarget' },
} as const;

/**
 * Sales coach — surfaces the operating doctrine's recommendation for a lead:
 * temperature, urgency, the recommended next channel/action, and best call
 * windows. Pure (server-rendered) from lib/sales-doctrine.
 */
export function SalesCoach({ signals }: { signals: LeadSignals }) {
  const r = recommendForLead(signals);
  const rec = REC[r.recommend];
  const strategy = callStrategy(signals.buyerType);
  const speed =
    signals.status === 'new' && !signals.firstResponseAt
      ? speedTier(Math.floor((Date.now() - new Date(signals.createdAt).getTime()) / 60000))
      : null;

  return (
    <div className="panel p-6">
      <h4 className="mb-3 flex items-center gap-2"><rec.icon size={15} className="text-champagne-600" strokeWidth={1.75} /> Sales coach</h4>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={TEMP[r.temperature].cls}>{TEMP[r.temperature].label}</span>
        <span className={`text-xs font-medium capitalize ${URGENCY[r.urgency]}`}>{r.urgency} urgency</span>
      </div>

      {speed && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-signal-danger">
          <Clock size={12} strokeWidth={1.75} /> Speed-to-lead: {speed.label}
        </p>
      )}

      <div className="mb-3 rounded border border-stone-line p-3">
        <p className="eyebrow mb-1">Recommended next step</p>
        <p className="flex items-center gap-2 text-sm font-medium text-forest"><rec.icon size={14} strokeWidth={1.75} /> {rec.label}</p>
        <p className="mt-1 text-sm text-charcoal-600/85">{r.nextAction}</p>
      </div>

      <div className="mb-3 rounded border border-stone-line p-3">
        <p className="eyebrow mb-1">Call strategy</p>
        <p className="flex items-center gap-2 text-sm font-medium text-forest">
          {strategy.order === 'call_first' ? <Phone size={14} strokeWidth={1.75} /> : <MessageCircle size={14} strokeWidth={1.75} />} {strategy.headline}
        </p>
        <p className="mt-1 text-xs text-charcoal-600/80">{strategy.detail}</p>
      </div>

      <div>
        <p className="eyebrow mb-1">Best call windows</p>
        <div className="flex flex-wrap gap-1.5">
          {r.callWindows.map((w) => <span key={w} className="badge-neutral figure">{w}</span>)}
        </div>
      </div>
    </div>
  );
}
