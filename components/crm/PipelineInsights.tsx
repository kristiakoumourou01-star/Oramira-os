import { TrendingDown, Timer, UserCheck, Gauge } from 'lucide-react';
import { lostReasonLabel, type PipelineSettings } from '@/lib/pipeline-shared';
import type { PipelineInsightData } from '@/lib/pipeline-insights';
import { formatCurrency } from '@/lib/format';

/**
 * Pipeline → «Ανάλυση»: γιατί χάνονται τα leads, πόσο κρατά κάθε στάδιο,
 * πόσοι είναι επιστρέφοντες πελάτες, και η σταθμισμένη αξία του pipeline.
 * Τελευταίες 180 μέρες. Χωρίς migration 0068 απλώς δεν εμφανίζεται.
 */
export function PipelineInsights({ cfg, data }: { cfg: PipelineSettings; data: PipelineInsightData | null }) {
  if (!data) return null;
  const { reasons, maxR, stageDur, late, weighted, returningWon } = data;
  const lost = { length: data.lostCount }; const open = { length: data.openCount }; const returning = { length: data.returning }; const main = { name: data.mainName };
  const Card = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) => (
    <div className="panel p-4"><p className="flex items-center gap-1.5 text-xs text-charcoal-600/70"><Icon size={13} /> {label}</p><p className="figure mt-1 text-2xl text-charcoal">{value}</p><p className="text-[11px] text-charcoal-600/60">{sub}</p></div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card icon={Gauge} label="Σταθμισμένη αξία pipeline" value={formatCurrency(weighted)} sub={`${open.length} ανοιχτά · budget × πιθανότητα σταδίου`} />
        <Card icon={Timer} label="Σε καθυστέρηση" value={String(late)} sub="πέρασαν το όριο ημερών του σταδίου" />
        <Card icon={TrendingDown} label="Χάθηκαν (180 μέρες)" value={String(lost.length)} sub={reasons[0] ? `κυρίως: ${reasons[0][0] === '_none' ? 'χωρίς λόγο' : lostReasonLabel(cfg, reasons[0][0])}` : '—'} />
        <Card icon={UserCheck} label="Επιστρέφοντες πελάτες" value={String(returning.length)} sub={`${returningWon} ξανά κλεισίματα`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h4 className="mb-3">Γιατί χάνονται</h4>
          {!reasons.length ? <p className="text-sm text-charcoal-600/60">Κανένα κλειστό lead τους τελευταίους 6 μήνες.</p> : (
            <ul className="space-y-2">
              {reasons.map(([k, n]) => (
                <li key={k} className="text-sm">
                  <div className="flex justify-between"><span>{k === '_none' ? 'Χωρίς καταγεγραμμένο λόγο' : lostReasonLabel(cfg, k)}</span><span className="figure text-charcoal-600">{n}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-stone"><div className="h-full rounded-full bg-signal-danger/60" style={{ width: `${(n / maxR) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel p-5">
          <h4 className="mb-3">Μέρες ανά στάδιο · {main.name}</h4>
          <ul className="space-y-1.5 text-sm">
            {stageDur.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2">
                <span>{s.label}</span>
                <span className={`figure ${s.avg !== null && s.max && s.avg > s.max ? 'text-signal-danger' : 'text-charcoal-600'}`}>
                  {s.avg === null ? '—' : `${s.avg.toFixed(1)} μέρ.`}{s.max ? <span className="text-charcoal-600/50"> / όριο {s.max}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-charcoal-600/60">Μέσος χρόνος πριν το lead προχωρήσει (ή κλείσει), από τις αλλαγές σταδίου των τελευταίων 6 μηνών.</p>
        </div>
      </div>
    </div>
  );
}

