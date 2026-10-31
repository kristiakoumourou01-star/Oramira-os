import Link from 'next/link';
import { Plus, FileText, Info } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { listDocuments, KIND_LABEL, KIND_PLURAL, STATUS_LABEL, money, type DocKind, type InvoiceDoc } from '@/lib/invoices';
import { formatDate } from '@/lib/format';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

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
        action={canIssue && !missing ? <Link href="/financials/invoices/new" className="btn-primary"><Plus size={15} /> Νέο τιμολόγιο</Link> : undefined}
      />

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
          <div key={l} className="panel p-4">
            <p className="eyebrow mb-2">{l}</p>
            <p className="figure text-[22px] leading-none text-forest">{v}</p>
            <p className="mt-1 text-[11px] text-charcoal-600/60">{h}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/financials/invoices${qs({})}`} className={`rounded-full px-3 py-1 text-sm ${!kind ? 'bg-forest text-white' : 'bg-stone text-charcoal-600 hover:bg-stone-line'}`}>Όλα</Link>
        {(['invoice', 'receipt', 'credit_note'] as DocKind[]).map((k) => (
          <Link key={k} href={`/financials/invoices${qs({ kind: k })}`} className={`rounded-full px-3 py-1 text-sm ${kind === k ? 'bg-forest text-white' : 'bg-stone text-charcoal-600 hover:bg-stone-line'}`}>{KIND_PLURAL[k]}</Link>
        ))}
      </div>

      <form className="panel grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end" method="get">
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
        <button className="btn-secondary">Φίλτρο</button>
      </form>

      <div className="panel overflow-x-auto p-0">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText size={22} className="mx-auto mb-2 text-charcoal-600/40" />
            <p className="text-sm text-charcoal-600/70">{missing ? 'Δεν υπάρχουν ακόμη παραστατικά.' : 'Δεν βρέθηκαν παραστατικά με αυτά τα φίλτρα.'}</p>
          </div>
        ) : (
          <table className="table-base w-full min-w-[760px]">
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
                  <tr key={d.id} className="hover:bg-stone/60">
                    <td><Link href={`/financials/invoices/${d.id}`} className="font-mono text-sm font-medium text-forest hover:underline">{d.number}</Link></td>
                    <td className="text-sm text-charcoal-600">{KIND_LABEL[d.kind]}</td>
                    <td className="text-sm text-charcoal-600">{formatDate(d.issue_date)}</td>
                    <td className="font-medium text-charcoal">{d.customer_name}</td>
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
