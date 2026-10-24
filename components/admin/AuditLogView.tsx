'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import type { AuditRow } from '@/lib/audit';

const ACTION_LABEL: Record<string, string> = {
  login: 'Σύνδεση',
  logout: 'Αποσύνδεση',
  created: 'Δημιουργία',
  status_changed: 'Αλλαγή status',
  impersonation_started: 'Έναρξη impersonation',
  impersonation_stopped: 'Λήξη impersonation',
  branding_updated: 'Ενημέρωση branding',
  user_invited: 'Πρόσκληση χρήστη',
  portal_activated: 'Ενεργοποίηση portal',
  contractor_assigned: 'Ανάθεση εργολάβου',
};
const humanAction = (a: string) => ACTION_LABEL[a] ?? a.replace(/_/g, ' ');

/** Minimal device summary from a user-agent string. */
function device(ua: string | null): string {
  if (!ua) return '—';
  const os = /Windows/i.test(ua) ? 'Windows' : /iPhone|iPad|iOS/i.test(ua) ? 'iOS' : /Mac/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /Linux/i.test(ua) ? 'Linux' : '';
  const br = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(' · ') || 'Άγνωστο';
}

export function AuditLogView({ rows }: { rows: AuditRow[] }) {
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('all');
  const [action, setAction] = useState('all');

  const actors = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.actorId) m.set(r.actorId, r.actorName ?? r.actorId.slice(0, 8));
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (actor !== 'all' && r.actorId !== actor) return false;
      if (action !== 'all' && r.action !== action) return false;
      if (needle) {
        const hay = `${r.actorName ?? ''} ${r.action} ${r.entityType} ${r.ip ?? ''} ${r.ua ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, actor, action]);

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[220px] flex-1">
          <span className="eyebrow mb-1 block">Αναζήτηση</span>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" strokeWidth={1.75} />
            <input className="input pl-9" placeholder="Χρήστης, ενέργεια, IP…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </label>
        <label>
          <span className="eyebrow mb-1 block">Χρήστης</span>
          <select className="input max-w-[200px]" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="all">Όλοι</option>
            {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label>
          <span className="eyebrow mb-1 block">Ενέργεια</span>
          <select className="input max-w-[200px]" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">Όλες</option>
            {actions.map((a) => <option key={a} value={a}>{humanAction(a)}</option>)}
          </select>
        </label>
        <span className="pb-2 text-xs text-charcoal-600/60">{filtered.length} εγγραφές</span>
      </div>

      <div className="panel overflow-hidden">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>Πότε</th>
              <th>Χρήστης</th>
              <th>Ενέργεια</th>
              <th>Αντικείμενο</th>
              <th>IP</th>
              <th>Συσκευή</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-stone/60">
                <td className="whitespace-nowrap text-xs text-charcoal-600">{formatDateTime(r.createdAt)}</td>
                <td>
                  <span className="font-medium text-charcoal">{r.actorName ?? 'System'}</span>
                  {r.actorRole && <span className="ml-2 badge-neutral capitalize">{r.actorRole}</span>}
                </td>
                <td className="text-charcoal">{humanAction(r.action)}</td>
                <td className="text-xs text-charcoal-600/80">{r.entityType}</td>
                <td className="figure text-xs text-charcoal-600">{r.ip ?? '—'}</td>
                <td className="text-xs text-charcoal-600/80">{device(r.ua)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-charcoal-600/70">Καμία εγγραφή με αυτά τα φίλτρα.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
