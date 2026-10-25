'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, X, Trash2 } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import {
  FIELD_TYPES, START_SCREENS,
  type InvoiceSettings, type NotificationSettings, type SecuritySettings,
  type TagsSettings, type PipelineSettings, type GdprSettings, type LayoutSettings, type DashboardSettings,
} from '@/lib/org-settings-shared';

/* ------------------------------------------------------------------ shared -- */
function useSlice<T>(slice: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const save = () =>
    start(async () => {
      const res = await saveOrgSlice(slice, v);
      if (res.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); }
      else setMsg({ ok: false, text: res.error });
    });
  const patch = (p: Partial<T>) => { setV((prev) => ({ ...prev, ...p })); setMsg(null); };
  return { v, setV, patch, save, pending, msg };
}

function SaveBar({ onSave, pending, msg, canEdit }: { onSave: () => void; pending: boolean; msg: { ok: boolean; text: string } | null; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-3">
      <button onClick={onSave} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
      {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (b: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-charcoal">{label}</span>
      <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-forest' : 'bg-stone-line'} disabled:opacity-50`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function ChipList({ items, onChange, placeholder, canEdit }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; canEdit: boolean }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (t && !items.includes(t)) onChange([...items, t]); setDraft(''); };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t} className="badge-neutral inline-flex items-center gap-1">{t}{canEdit && <button onClick={() => onChange(items.filter((x) => x !== t))} className="text-charcoal-600/50 hover:text-signal-danger"><X size={11} /></button>}</span>
        ))}
        {items.length === 0 && <span className="text-xs text-charcoal-600/50">—</span>}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <input className="input" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <button onClick={add} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
        </div>
      )}
    </div>
  );
}

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;

/* --------------------------------------------------------------- Invoices -- */
export function InvoicesSection({ initial, canEdit }: { initial: InvoiceSettings; canEdit: boolean }) {
  const { v, setV, patch, save, pending, msg } = useSlice('invoices', initial);
  const setRate = (i: number, p: Partial<InvoiceSettings['vatRates'][number]>) => setV({ ...v, vatRates: v.vatRates.map((r, idx) => (idx === i ? { ...r, ...p } : r)) });
  const setSeries = (i: number, p: Partial<InvoiceSettings['series'][number]>) => setV({ ...v, series: v.series.map((s, idx) => (idx === i ? { ...s, ...p } : s)) });
  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <h4>VAT rates</h4>
        {v.vatRates.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_1.6fr] items-center gap-2">
            <input className="input" disabled={!canEdit} value={r.label} onChange={(e) => setRate(i, { label: e.target.value })} />
            <input className="input figure" disabled={!canEdit} type="number" value={r.rate} onChange={(e) => setRate(i, { rate: Number(e.target.value) })} />
            <input className="input" disabled={!canEdit} value={r.note} onChange={(e) => setRate(i, { note: e.target.value })} />
          </div>
        ))}
        <label className="block max-w-[200px]"><Lbl>Default VAT %</Lbl><input className="input figure" disabled={!canEdit} type="number" value={v.defaultVat} onChange={(e) => patch({ defaultVat: Number(e.target.value) })} /></label>
      </div>
      <div className="panel space-y-3 p-5">
        <h4>Numbering series</h4>
        {v.series.map((s, i) => (
          <div key={i} className="grid grid-cols-[1.4fr_1fr_90px] items-center gap-2">
            <input className="input" disabled={!canEdit} value={s.label} onChange={(e) => setSeries(i, { label: e.target.value })} />
            <input className="input" disabled={!canEdit} value={s.prefix} onChange={(e) => setSeries(i, { prefix: e.target.value })} />
            <input className="input figure" disabled={!canEdit} type="number" value={s.next} onChange={(e) => setSeries(i, { next: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      <div className="panel space-y-1 p-5">
        <h4 className="mb-2">Receipt</h4>
        <Toggle label="Show logo on receipt" checked={v.receiptShowLogo} onChange={(b) => patch({ receiptShowLogo: b })} disabled={!canEdit} />
        <Toggle label="Show company address" checked={v.receiptShowAddress} onChange={(b) => patch({ receiptShowAddress: b })} disabled={!canEdit} />
        <Toggle label="Show bank / IBAN" checked={v.receiptShowBank} onChange={(b) => patch({ receiptShowBank: b })} disabled={!canEdit} />
        <Toggle label="myDATA export" checked={v.mydataExport} onChange={(b) => patch({ mydataExport: b })} disabled={!canEdit} />
      </div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} />
    </div>
  );
}

/* ---------------------------------------------------------- Notifications -- */
export function NotificationsSection({ initial, canEdit }: { initial: NotificationSettings; canEdit: boolean }) {
  const { v, setV, patch, save, pending, msg } = useSlice('notifications', initial);
  const ch = (['inApp', 'push', 'email', 'sms'] as const);
  const chLabel: Record<string, string> = { inApp: 'In-app', push: 'Push', email: 'Email', sms: 'SMS' };
  const toggle = (i: number, k: typeof ch[number]) => setV({ ...v, rows: v.rows.map((r, idx) => (idx === i ? { ...r, [k]: !r[k] } : r)) });
  return (
    <div className="space-y-4">
      <div className="panel overflow-x-auto p-0">
        <table className="table-base w-full min-w-[560px]">
          <thead><tr><th>Event</th><th>Who</th>{ch.map((c) => <th key={c} className="text-center">{chLabel[c]}</th>)}</tr></thead>
          <tbody>
            {v.rows.map((r, i) => (
              <tr key={i}>
                <td className="font-medium text-charcoal">{r.event}</td>
                <td><input className="input max-w-[180px]" disabled={!canEdit} value={r.who} onChange={(e) => setV({ ...v, rows: v.rows.map((x, idx) => (idx === i ? { ...x, who: e.target.value } : x)) })} /></td>
                {ch.map((c) => (
                  <td key={c} className="text-center">
                    <input type="checkbox" disabled={!canEdit} checked={r[c]} onChange={() => toggle(i, c)} className="h-4 w-4 accent-[color:rgb(var(--c-forest))]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel flex flex-wrap items-end gap-4 p-5">
        <h4 className="w-full">Quiet hours</h4>
        <label><Lbl>From</Lbl><input className="input" type="time" disabled={!canEdit} value={v.quietFrom} onChange={(e) => patch({ quietFrom: e.target.value })} /></label>
        <label><Lbl>To</Lbl><input className="input" type="time" disabled={!canEdit} value={v.quietTo} onChange={(e) => patch({ quietTo: e.target.value })} /></label>
      </div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} />
    </div>
  );
}

/* --------------------------------------------------------------- Security -- */
export function SecuritySection({ initial, canEdit }: { initial: SecuritySettings; canEdit: boolean }) {
  const { v, patch, save, pending, msg } = useSlice('security', initial);
  return (
    <div className="space-y-4">
      <div className="panel space-y-1 p-5">
        <h4 className="mb-2">Login</h4>
        <Toggle label="Require OTP (two-factor)" checked={v.otp} onChange={(b) => patch({ otp: b })} disabled={!canEdit} />
        <Toggle label="Remember trusted devices" checked={v.trustedDevices} onChange={(b) => patch({ trustedDevices: b })} disabled={!canEdit} />
        <label className="block max-w-[220px] pt-2"><Lbl>Session timeout (hours)</Lbl><input className="input figure" type="number" disabled={!canEdit} value={v.sessionTimeoutHours} onChange={(e) => patch({ sessionTimeoutHours: Number(e.target.value) })} /></label>
      </div>
      <div className="panel space-y-1 p-5">
        <h4 className="mb-2">Passwords</h4>
        <label className="block max-w-[220px]"><Lbl>Minimum length</Lbl><input className="input figure" type="number" disabled={!canEdit} value={v.pwLength} onChange={(e) => patch({ pwLength: Number(e.target.value) })} /></label>
        <Toggle label="Require a symbol" checked={v.pwSymbols} onChange={(b) => patch({ pwSymbols: b })} disabled={!canEdit} />
        <Toggle label="Expire every 90 days" checked={v.pwExpire90} onChange={(b) => patch({ pwExpire90: b })} disabled={!canEdit} />
      </div>
      <div className="panel p-5">
        <label className="block"><Lbl>IP allow-list (optional, comma-separated)</Lbl><input className="input" disabled={!canEdit} value={v.ipAllowList} placeholder="e.g. 203.0.113.4, 198.51.100.0/24" onChange={(e) => patch({ ipAllowList: e.target.value })} /></label>
      </div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} />
    </div>
  );
}

/* ------------------------------------------------------------------- Tags -- */
export function TagsSection({ initial, canEdit }: { initial: TagsSettings; canEdit: boolean }) {
  const { v, setV, save, pending, msg } = useSlice('tags', initial);
  const setField = (i: number, p: Partial<TagsSettings['fields'][number]>) => setV({ ...v, fields: v.fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)) });
  return (
    <div className="space-y-4">
      <div className="panel p-5"><h4 className="mb-3">Contact tags</h4><ChipList items={v.tags} onChange={(tags) => setV({ ...v, tags })} placeholder="New tag" canEdit={canEdit} /></div>
      <div className="panel p-5"><h4 className="mb-3">Saved groups</h4><ChipList items={v.groups} onChange={(groups) => setV({ ...v, groups })} placeholder="New group" canEdit={canEdit} /></div>
      <div className="panel space-y-2 p-5">
        <div className="flex items-center justify-between"><h4>Custom fields</h4>{canEdit && <button onClick={() => setV({ ...v, fields: [...v.fields, { name: '', type: 'Text', required: false }] })} className="btn-ghost text-xs"><Plus size={13} /> Add field</button>}</div>
        {v.fields.map((f, i) => (
          <div key={i} className="grid grid-cols-[1.4fr_1fr_auto_auto] items-center gap-2">
            <input className="input" disabled={!canEdit} placeholder="Field name" value={f.name} onChange={(e) => setField(i, { name: e.target.value })} />
            <select className="input" disabled={!canEdit} value={f.type} onChange={(e) => setField(i, { type: e.target.value })}>{FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <button onClick={() => setField(i, { required: !f.required })} disabled={!canEdit} className={`badge ${f.required ? 'badge-forest' : 'badge-neutral'}`}>{f.required ? 'Required' : 'Optional'}</button>
            {canEdit && <button onClick={() => setV({ ...v, fields: v.fields.filter((_, idx) => idx !== i) })} className="text-signal-danger/70 hover:text-signal-danger"><Trash2 size={15} /></button>}
          </div>
        ))}
      </div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} />
    </div>
  );
}

/* -------------------------------------------------------------- Pipelines -- */
export function PipelinesSection({ initial, canEdit }: { initial: PipelineSettings; canEdit: boolean }) {
  const { v, setV, save, pending, msg } = useSlice('pipelines', initial);
  const setStage = (i: number, p: Partial<PipelineSettings['stages'][number]>) => setV({ ...v, stages: v.stages.map((s, idx) => (idx === i ? { ...s, ...p } : s)) });
  return (
    <div className="space-y-4">
      <div className="panel space-y-2 p-5">
        <div className="flex items-center justify-between"><h4>Pipeline stages</h4>{canEdit && <button onClick={() => setV({ ...v, stages: [...v.stages, { name: '', probability: 0 }] })} className="btn-ghost text-xs"><Plus size={13} /> Add stage</button>}</div>
        {v.stages.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_auto] items-center gap-2">
            <input className="input" disabled={!canEdit} placeholder="Stage name" value={s.name} onChange={(e) => setStage(i, { name: e.target.value })} />
            <div className="flex items-center gap-1"><input className="input figure" disabled={!canEdit} type="number" value={s.probability} onChange={(e) => setStage(i, { probability: Number(e.target.value) })} /><span className="text-xs text-charcoal-600/60">%</span></div>
            {canEdit && <button onClick={() => setV({ ...v, stages: v.stages.filter((_, idx) => idx !== i) })} className="text-signal-danger/70 hover:text-signal-danger"><Trash2 size={15} /></button>}
          </div>
        ))}
      </div>
      <div className="panel p-5"><h4 className="mb-3">Lead sources</h4><ChipList items={v.sources} onChange={(sources) => setV({ ...v, sources })} placeholder="New source" canEdit={canEdit} /></div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} />
    </div>
  );
}

/* ------------------------------------------------------------------- GDPR -- */
export function GdprSection({ initial, canEdit }: { initial: GdprSettings; canEdit: boolean }) {
  const { v, patch, save, pending, msg } = useSlice('gdpr', initial);
  return (
    <div className="space-y-4">
      <div className="panel p-5"><label className="block"><Lbl>Consent text</Lbl><textarea className="input min-h-[90px]" disabled={!canEdit} value={v.consentText} onChange={(e) => patch({ consentText: e.target.value })} /></label></div>
      <div className="panel grid grid-cols-2 gap-4 p-5">
        <label className="block"><Lbl>Keep leads (months)</Lbl><input className="input figure" type="number" disabled={!canEdit} value={v.retentionLeadsMonths} onChange={(e) => patch({ retentionLeadsMonths: Number(e.target.value) })} /></label>
        <label className="block"><Lbl>Keep deals (years)</Lbl><input className="input figure" type="number" disabled={!canEdit} value={v.retentionDealsYears} onChange={(e) => patch({ retentionDealsYears: Number(e.target.value) })} /></label>
      </div>
      <div className="panel p-5"><Toggle label="Marketing opt-in by default" checked={v.marketingOptIn} onChange={(b) => patch({ marketingOptIn: b })} disabled={!canEdit} /></div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} />
    </div>
  );
}

/* ----------------------------------------------------------------- Layout -- */
export function LayoutSection({ initial, canEdit }: { initial: LayoutSettings; canEdit: boolean }) {
  const { v, patch, save, pending, msg } = useSlice('layout', initial);
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <label className="block max-w-[280px]"><Lbl>Start screen (where staff land)</Lbl>
          <select className="input" disabled={!canEdit} value={v.startScreen} onChange={(e) => patch({ startScreen: e.target.value })}>
            {START_SCREENS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <div className="panel space-y-1 p-5">
        <Toggle label="Compact sidebar by default" checked={v.sidebarCompact} onChange={(b) => patch({ sidebarCompact: b })} disabled={!canEdit} />
        <Toggle label="Dense lists & tables" checked={v.denseLists} onChange={(b) => patch({ denseLists: b })} disabled={!canEdit} />
        <p className="pt-1 text-xs text-charcoal-600/60">Το πλάτος & η πυκνότητα του περιεχομένου ρυθμίζονται και στο <strong>Appearance</strong>.</p>
      </div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} />
    </div>
  );
}

/* -------------------------------------------------------------- Dashboard -- */
export function DashboardSection({ initial, canEdit }: { initial: DashboardSettings; canEdit: boolean }) {
  const { v, setV, save, pending, msg } = useSlice('dashboard', initial);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= v.blocks.length) return;
    const b = [...v.blocks]; [b[i], b[j]] = [b[j], b[i]]; setV({ ...v, blocks: b });
  };
  return (
    <div className="space-y-4">
      <div className="panel space-y-1 p-5">
        <p className="mb-2 text-sm text-charcoal-600/70">Choose which cards appear on the dashboard and their order.</p>
        {v.blocks.map((b, i) => (
          <div key={b.key} className="flex items-center justify-between gap-3 border-b border-stone-line py-2 last:border-0">
            <span className="text-sm text-charcoal">{b.label}</span>
            <div className="flex items-center gap-2">
              {canEdit && <><button onClick={() => move(i, -1)} disabled={i === 0} className="btn-ghost px-1.5 py-1 text-xs disabled:opacity-30">↑</button><button onClick={() => move(i, 1)} disabled={i === v.blocks.length - 1} className="btn-ghost px-1.5 py-1 text-xs disabled:opacity-30">↓</button></>}
              <Toggle label="" checked={b.visible} onChange={(val) => setV({ ...v, blocks: v.blocks.map((x, idx) => (idx === i ? { ...x, visible: val } : x)) })} disabled={!canEdit} />
            </div>
          </div>
        ))}
      </div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} />
    </div>
  );
}
