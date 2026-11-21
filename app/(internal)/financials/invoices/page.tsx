import Link from 'next/link';
import { Plus, FileText, Info } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { listDocuments, KIND_LABEL, KIND_PLURAL, STATUS_LABEL, money, type DocKind, type InvoiceDoc } from '@/lib/invoices';
import { formatDate } from '@/lib/format';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { HubLinks } from '@/components/ui/HubTabs';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  issued: 'badge-champagne', partially_paid: 'badge-champagne', paid: 'badge-forest',
  partially_credited: 'badge-neutral', credited: 'badge-neutral',
};

/** Οικονομικά → Τιμολόγια: every invoice, receipt and credit note, with what is still open. */
export default async function InvoicesPage({ searchParams }: { searchParams: { kind?: string; status?: string; q?: string; from?: string; to?: string } }) {
  const profile = await requirePermission('financials');
  const canIssue = effectiveCan(profile.role, profile.moduleAccess, 'financials', 'edit', profile.permissions);
  const kind = (['invoice', 'receipt', 'credit_note'] as const).find((k) => k === searchParams.kind) ?? '';

  // Everything in range (for balances), then the view filter.
  const { rows: all, missing } = await listDocuments({ q: searchParams.q, from: searchParams.from, to: searchParams.to });
  const rows = all.filter((d) => (!kind || d.kind === kind) && (!searchParams.status || (d.kind === 'invoice' && d.status === searchParams.status)));

  const openOf = (inv: InvoiceDoc) => {
    const rel = all.filter((d) => d.related_id === inv.id);
    const less = rel.reduce((s, d) => s + Number(d.total), 0);
    return Math.max(0, Math.round((Number(inv.total) - less) * 100) / 100);
  };
  const invoices = all.filter((d) => d.kind === 'invoice');
  const today = new Date().toISOString().slice(0, 10);
  const open = invoices.reduce((s, d) => s + openOf(d), 0);
  const overdue = invoices.filter((d) => d.due_date && d.due_date < today && openOf(d) > 0);
  const month = today.slice(0, 7);
  const issuedMonth = invoices.filter((d) => d.issue_date.startsWith(month)).reduce((s, d) => s + Number(d.total), 0);
  const vatMonth = all.filter((d) => d.issue_date.startsWith(month)).reduce((s, d) => s + (d.kind === 'credit_note' ? -1 : d.kind === 'invoice' ? 1 : 0) * Number(d.vat_total), 0);

  const qs = (p: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: searchParams.q ?? '', from: searchParams.from ?? '', to: searchParams.to ?? '', ...p })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `?${s}` : '';
  };

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="Οικονομικά"
        title="Τιμολόγια"
        description="Τιμολόγια, αποδείξεις και πιστωτικά με αρίθμηση χωρίς κενά. Ένα εκδοθέν παραστατικό δεν αλλάζει — διορθώνεται με πιστωτικό."
        action={canIssue && !missing ? <Link href="/financials/invoices/new" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[14px] font-medium text-white hover:bg-forest/90"><Plus size={15} /> Νέο τιμολόγιο</Link> : undefined}
      />
      <HubLinks cols={3} active="invoices" cards={[
        { key: 'overview', icon: 'Wallet', title: 'Επισκόπηση', sub: 'Εισπράξεις, υπόλοιπα, απόδοση έργων', href: '/financials' },
        { key: 'invoices', icon: 'Receipt', title: 'Τιμολόγια', value: invoices.length, sub: `${money(open)} προς είσπραξη`, href: '/financials/invoices' },
        { key: 'reports', icon: 'BarChart3', title: 'Αναφορές', sub: 'Έτοιμες και δικές σας αναφορές', href: '/reports' },
      ]} />

      {missing && (
        <p className="flex items-start gap-2 rounded-md bg-champagne-50 px-4 py-3 text-sm text-champagne-600">
          <Info size={15} className="mt-0.5 shrink-0" />
          Για να ενεργοποιηθούν τα τιμολόγια, τρέξτε μία φορά το αρχείο supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql στο Supabase → SQL Editor → Run.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Προς είσπραξη', money(open), `${invoices.filter((d) => openOf(d) > 0).length} ανοιχτά τιμολόγια`],
          ['Ληξιπρόθεσμα', money(overdue.reduce((s, d) => s + openOf(d), 0)), `${overdue.length} τιμολόγια`],
          ['Τιμολογήθηκαν τον μήνα', money(issuedMonth), 'με ΦΠΑ'],
          ['ΦΠΑ μήνα', money(vatMonth), 'τιμολόγια μείον πιστωτικά'],
        ].map(([l, v, h]) => (
          <div key={l} className="rounded-[14px] border border-stone-line bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600">{l}</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums leading-tight text-charcoal">{v}</p>
            <p className="mt-1 text-[12px] text-charcoal-600">{h}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/financials/invoices${qs({})}`} className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] ${!kind ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`}>Όλα</Link>
        {(['invoice', 'receipt', 'credit_note'] as DocKind[]).map((k) => (
          <Link key={k} href={`/financials/invoices${qs({ kind: k })}`} className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] ${kind === k ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`}>{KIND_PLURAL[k]}</Link>
        ))}
      </div>

      <form className="grid rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end" method="get">
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label className="block"><span className="eyebrow mb-1 block">Αναζήτηση</span><input className="input" name="q" defaultValue={searchParams.q ?? ''} placeholder="Αριθμός, πελάτης, email" /></label>
        <label className="block"><span className="eyebrow mb-1 block">Κατάσταση</span>
          <select className="input" name="status" defaultValue={searchParams.status ?? ''}>
            <option value="">Όλες</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block"><span className="eyebrow mb-1 block">Από</span><input className="input" type="date" name="from" defaultValue={searchParams.from ?? ''} /></label>
        <label className="block"><span className="eyebrow mb-1 block">Έως</span><input className="input" type="date" name="to" defaultValue={searchParams.to ?? ''} /></label>
        <button className="inline-flex h-9 items-center justify-center rounded-[10px] bg-forest px-4 text-[14px] font-medium text-white hover:bg-forest/90">Φίλτρο</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText size={22} className="mx-auto mb-2 text-charcoal-600/40" />
            <p className="text-sm text-charcoal-600/70">{missing ? 'Δεν υπάρχουν ακόμη παραστατικά.' : 'Δεν βρέθηκαν παραστατικά με αυτά τα φίλτρα.'}</p>
          </div>
        ) : (
          <table className="o-table">
            <thead>
              <tr><th>Αριθμός</th><th>Είδος</th><th>Ημερομηνία</th><th>Πελάτης</th><th className="text-right">Καθαρό</th><th className="text-right">ΦΠΑ</th><th className="text-right">Σύνολο</th><th className="text-right">Υπόλοιπο</th><th>Κατάσταση</th></tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const isInv = d.kind === 'invoice';
                const bal = isInv ? openOf(d) : null;
                const late = isInv && d.due_date && d.due_date < today && (bal ?? 0) > 0;
                const sign = d.kind === 'credit_note' ? '−' : '';
                return (
                  <tr key={d.id}>
                    <td><Link href={`/financials/invoices/${d.id}`} className="font-mono font-medium text-forest hover:underline">{d.number}</Link></td>
                    <td>{KIND_LABEL[d.kind]}</td>
                    <td>{formatDate(d.issue_date)}</td>
                    <td className="o-strong" data-no-tr>{d.customer_name}</td>
                    <td className="figure text-right text-charcoal-600">{sign}{money(d.net_total)}</td>
                    <td className="figure text-right text-charcoal-600">{sign}{money(d.vat_total)}</td>
                    <td className="figure text-right">{sign}{money(d.total)}</td>
                    <td className={`figure text-right ${late ? 'text-signal-danger' : 'text-charcoal-600'}`}>{bal == null ? '' : money(bal)}</td>
                    <td>{isInv ? <span className={STATUS_BADGE[d.status]}>{late ? 'Ληξιπρόθεσμο' : STATUS_LABEL[d.status]}</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
