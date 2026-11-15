'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Handshake, Eye, MousePointerClick, Plus, Search, Pencil, Trash2, X, ExternalLink } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import { saveBenefit, deleteBenefit } from '@/app/actions/benefits';

export interface Benefit { id: string; partner: string; title: string; description: string | null; discount: string | null; category: string | null; code: string | null; link: string | null; audience: string[]; active: boolean; validUntil: string | null; views: number; taps: number }
const AUD: [string, string][] = [['buyer', 'Αγοραστές'], ['homeowner', 'Ιδιοκτήτες'], ['investor', 'Επενδυτές'], ['lead', 'Leads']];
const CATS = ['Έπιπλα & διακόσμηση', 'Τράπεζες & δάνεια', 'Νομικά', 'Μετακόμιση', 'Ασφάλειες', 'Ηλεκτρικές συσκευές', 'Καθαρισμός & συντήρηση', 'Άλλο'];
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest';

export function BenefitsHub({ rows, canEdit }: { rows: Benefit[]; canEdit: boolean }) {
  const router = useRouter();
  const [view, setView] = useState('active');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [dlg, setDlg] = useState<Benefit | 'new' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const live = (b: Benefit) => b.active && (!b.validUntil || b.validUntil >= today);
  const partners = new Set(rows.map((r) => r.partner)).size;
  const base = view === 'active' ? rows.filter(live) : view === 'inactive' ? rows.filter((b) => !live(b)) : rows;
  const list = base.filter((b) => (!cat || b.category === cat) && (!q || [b.partner, b.title, b.description ?? '', b.code ?? ''].join(' ').toLowerCase().includes(q.toLowerCase())));
  const del = (b: Benefit) => { if (!confirm(`Διαγραφή «${b.title}»;`)) return; start(async () => { const r = await deleteBenefit(b.id); setMsg(r.ok ? { ok: true, text: 'Διαγράφηκε.' } : { ok: false, text: r.error }); router.refresh(); }); };
  return (
    <div className="space-y-5">
      <HubCards active={view} onSelect={setView} cards={[
        { key: 'active', icon: Gift, title: 'Ενεργά', value: rows.filter(live).length, sub: 'Εμφανίζονται στην εφαρμογή' },
        { key: 'all', icon: Handshake, title: 'Συνεργάτες', value: partners, sub: `${rows.length} παροχές συνολικά` },
        { key: 'inactive', icon: Eye, title: 'Ανενεργά / έληξαν', value: rows.filter((b) => !live(b)).length, sub: 'Κρυμμένα από την εφαρμογή' },
        { key: 'stats', icon: MousePointerClick, title: 'Προβολές', value: rows.reduce((s, b) => s + b.views, 0), sub: `${rows.reduce((s, b) => s + b.taps, 0)} πατήματα` },
      ]} />
      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}
      <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input h-10 w-auto min-w-[180px] text-sm"><option value="">Όλες οι κατηγορίες</option>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <label className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση…" className="input h-10 pl-9" /></label>
          {canEdit && <button type="button" onClick={() => setDlg('new')} className="btn-primary ml-auto text-sm"><Plus size={15} /> Νέα παροχή</button>}
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="table-base w-full min-w-[820px]">
            <thead><tr><th>Συνεργάτης</th><th>Παροχή</th><th>Για</th><th>Ισχύει έως</th><th className="text-right">Προβολές</th><th className="text-right">Πατήματα</th><th className="text-right">Ενέργειες</th></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className={live(b) ? '' : 'opacity-60'}>
                  <td><span className="font-semibold text-charcoal" data-no-tr>{b.partner}</span>{b.category && <span className="block text-[12px] text-charcoal-600">{b.category}</span>}</td>
                  <td><span className="text-charcoal" data-no-tr>{b.title}</span> {b.discount && <span className="ml-1 rounded-full bg-forest/[0.08] px-2 py-0.5 text-[12px] font-semibold text-forest" data-no-tr>{b.discount}</span>}{b.code && <span className="block font-mono text-[12px] text-charcoal-600" data-no-tr>Κωδικός: {b.code}</span>}</td>
                  <td className="text-sm text-charcoal-600">{b.audience.map((a) => AUD.find((x) => x[0] === a)?.[1] ?? a).join(', ') || '—'}</td>
                  <td className="text-sm text-charcoal-600">{b.validUntil ? new Date(b.validUntil).toLocaleDateString('el-GR') : 'Χωρίς λήξη'}</td>
                  <td className="text-right tabular-nums">{b.views}</td><td className="text-right tabular-nums">{b.taps}</td>
                  <td><span className="flex justify-end gap-1">
                    {b.link && <a href={b.link} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Σύνδεσμος" aria-label="Σύνδεσμος"><ExternalLink size={15} /></a>}
                    {canEdit && <button type="button" onClick={() => setDlg(b)} className={iconBtn} title="Επεξεργασία" aria-label="Επεξεργασία"><Pencil size={15} /></button>}
                    {canEdit && <button type="button" onClick={() => del(b)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-rose-50 hover:text-signal-danger" title="Διαγραφή" aria-label="Διαγραφή"><Trash2 size={15} /></button>}
                  </span></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-charcoal-600">Δεν υπάρχουν παροχές. Πατήστε «Νέα παροχή».</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {dlg && <BenefitDialog b={dlg === 'new' ? null : dlg} onClose={() => setDlg(null)} onDone={(t) => { setDlg(null); setMsg({ ok: true, text: t }); router.refresh(); }} />}
    </div>
  );
}

function BenefitDialog({ b, onClose, onDone }: { b: Benefit | null; onClose: () => void; onDone: (t: string) => void }) {
  const [f, setF] = useState({ partner: b?.partner ?? '', title: b?.title ?? '', description: b?.description ?? '', discount: b?.discount ?? '', category: b?.category ?? CATS[0], code: b?.code ?? '', link: b?.link ?? '', audience: b?.audience ?? ['buyer', 'homeowner'], active: b?.active ?? true, validUntil: b?.validUntil ?? '' });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = () => start(async () => { const r = await saveBenefit(b?.id ?? null, f); if (!r.ok) { setErr(r.error); return; } onDone(b ? 'Αποθηκεύτηκε.' : 'Η παροχή προστέθηκε.'); });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-2xl">{b ? 'Επεξεργασία ' : 'Νέα '}<em className="text-forest">παροχή</em></h3><button type="button" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <div className="space-y-3 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={lbl}>Συνεργάτης *</span><input autoFocus className="input" value={f.partner} onChange={(e) => set({ partner: e.target.value })} placeholder="π.χ. IKEA Λεμεσός" /></label>
            <label className="block"><span className={lbl}>Κατηγορία</span><select className="input" value={f.category} onChange={(e) => set({ category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          </div>
          <label className="block"><span className={lbl}>Τίτλος παροχής *</span><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="π.χ. Έκπτωση στην επίπλωση του νέου σπιτιού" /></label>
          <label className="block"><span className={lbl}>Περιγραφή</span><textarea className="input min-h-[70px]" value={f.description} onChange={(e) => set({ description: e.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className={lbl}>Έκπτωση</span><input className="input" value={f.discount} onChange={(e) => set({ discount: e.target.value })} placeholder="π.χ. -15%" /></label>
            <label className="block"><span className={lbl}>Κωδικός</span><input className="input" value={f.code} onChange={(e) => set({ code: e.target.value })} /></label>
            <label className="block"><span className={lbl}>Ισχύει έως</span><input type="date" className="input" value={f.validUntil} onChange={(e) => set({ validUntil: e.target.value })} /></label>
          </div>
          <label className="block"><span className={lbl}>Σύνδεσμος</span><input className="input" value={f.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://" /></label>
          <div><span className={lbl}>Για ποιους</span><div className="flex flex-wrap gap-1.5">{AUD.map(([k, l]) => { const on = f.audience.includes(k); return <button key={k} type="button" onClick={() => set({ audience: on ? f.audience.filter((x) => x !== k) : [...f.audience, k] })} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-forest/40 bg-forest/[0.08] text-forest' : 'border-stone-line'}`}>{l}</button>; })}</div></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Ενεργή (εμφανίζεται στην εφαρμογή)</label>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-6 py-4"><button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button><button type="button" className="btn-primary" disabled={pending || !f.partner.trim() || !f.title.trim()} onClick={save}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></div>
      </div>
    </div>
  );
}
