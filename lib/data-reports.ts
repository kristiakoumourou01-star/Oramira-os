/**
 * Αναφορές με δεδομένα (πίνακας + export) για το Reports. Server-only.
 * Κάθε αναφορά επιστρέφει στήλες, γραμμές και λίγα συνοπτικά νούμερα.
 */
export interface DataReport {
  columns: { key: string; label: string; align?: 'right' | 'left'; money?: boolean }[];
  rows: Record<string, string | number | null>[];
  summary: { label: string; value: string }[];
  note?: string;
}

const eur = (n: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const d = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Nicosia' }) : '');
const SRC: Record<string, string> = { website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Σύσταση', whatsapp: 'WhatsApp', walk_in: 'Walk-in', other: 'Άλλο', manual: 'Καταχώριση' };
const UNIT_ST: Record<string, string> = { available: 'Διαθέσιμη', reserved: 'Κρατημένη', sold: 'Πωλημένη', not_released: 'Μη διαθέσιμη', blocked: 'Μπλοκαρισμένη' };

export async function buildDataReport(supabase: any, key: string): Promise<DataReport | null> {
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
  switch (key) {
    case 'leads_source': {
      const { data } = await supabase.from('leads').select('source, status, won_at, lost_at, created_at').is('deleted_at', null).gte('created_at', since90);
      const m = new Map<string, { n: number; won: number; lost: number }>();
      for (const l of (data ?? []) as any[]) { const k = l.source ?? 'other'; const x = m.get(k) ?? { n: 0, won: 0, lost: 0 }; x.n++; if (l.status === 'won' || l.won_at) x.won++; if (l.status === 'lost' || l.lost_at) x.lost++; m.set(k, x); }
      const rows = Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n).map(([k, x]) => ({ source: SRC[k] ?? k, leads: x.n, won: x.won, lost: x.lost, conv: x.n ? `${Math.round((x.won / x.n) * 100)}%` : '0%' }));
      const total = rows.reduce((s, r) => s + r.leads, 0); const won = rows.reduce((s, r) => s + r.won, 0);
      return { columns: [{ key: 'source', label: 'Πηγή' }, { key: 'leads', label: 'Leads', align: 'right' }, { key: 'won', label: 'Won', align: 'right' }, { key: 'lost', label: 'Lost', align: 'right' }, { key: 'conv', label: 'Μετατροπή', align: 'right' }], rows,
        summary: [{ label: 'Leads (90 ημ.)', value: String(total) }, { label: 'Won', value: String(won) }, { label: 'Μετατροπή', value: total ? `${Math.round((won / total) * 100)}%` : '0%' }], note: 'Τελευταίες 90 ημέρες.' };
    }
    case 'pipeline': {
      const { data } = await supabase.from('leads').select('stage, status, value, budget_max, budget_min').is('deleted_at', null).is('archived_at', null).not('status', 'in', '(won,lost)');
      const m = new Map<string, { n: number; v: number }>();
      for (const l of (data ?? []) as any[]) { const k = l.stage ?? l.status ?? '—'; const x = m.get(k) ?? { n: 0, v: 0 }; x.n++; x.v += Number(l.value ?? l.budget_max ?? l.budget_min ?? 0) || 0; m.set(k, x); }
      const rows = Array.from(m.entries()).map(([k, x]) => ({ stage: k.replace(/_/g, ' '), deals: x.n, value: eur(x.v), avg: eur(x.n ? x.v / x.n : 0) }));
      const tv = Array.from(m.values()).reduce((s, x) => s + x.v, 0); const tn = Array.from(m.values()).reduce((s, x) => s + x.n, 0);
      return { columns: [{ key: 'stage', label: 'Στάδιο' }, { key: 'deals', label: 'Deals', align: 'right' }, { key: 'value', label: 'Αξία', align: 'right' }, { key: 'avg', label: 'Μέση αξία', align: 'right' }], rows,
        summary: [{ label: 'Ανοιχτά deals', value: String(tn) }, { label: 'Αξία pipeline', value: eur(tv) }] };
    }
    case 'inventory': {
      const { data } = await supabase.from('units').select('unit_number, type, sqm, internal_sqm, price, status, projects(name)').order('unit_number');
      const rows = ((data ?? []) as any[]).map((u) => ({ project: u.projects?.name ?? '—', unit: u.unit_number ?? '—', type: u.type ?? '', sqm: u.internal_sqm ?? u.sqm ?? '', price: u.price ? eur(Number(u.price)) : '', status: UNIT_ST[u.status] ?? u.status ?? '' }));
      const cnt = (s: string) => ((data ?? []) as any[]).filter((u) => u.status === s).length;
      const avail = ((data ?? []) as any[]).filter((u) => u.status === 'available').reduce((s, u) => s + Number(u.price ?? 0), 0);
      return { columns: [{ key: 'project', label: 'Έργο' }, { key: 'unit', label: 'Μονάδα' }, { key: 'type', label: 'Τύπος' }, { key: 'sqm', label: 'm²', align: 'right' }, { key: 'price', label: 'Τιμή', align: 'right' }, { key: 'status', label: 'Κατάσταση' }], rows,
        summary: [{ label: 'Μονάδες', value: String(rows.length) }, { label: 'Διαθέσιμες', value: String(cnt('available')) }, { label: 'Κρατημένες', value: String(cnt('reserved')) }, { label: 'Πωλημένες', value: String(cnt('sold')) }, { label: 'Αξία διαθέσιμων', value: eur(avail) }] };
    }
    case 'reservations': {
      const { data } = await supabase.from('reservations').select('reserved_at, deposit_amount, deposit_paid, status, expires_at, units(unit_number, projects(name)), contacts:buyer_contact_id(full_name)').order('reserved_at', { ascending: false });
      const rows = ((data ?? []) as any[]).map((r) => ({ date: d(r.reserved_at), project: r.units?.projects?.name ?? '', unit: r.units?.unit_number ?? '', buyer: r.contacts?.full_name ?? '', deposit: r.deposit_amount ? eur(Number(r.deposit_amount)) : '', paid: r.deposit_paid ? 'Ναι' : 'Όχι', expires: r.expires_at ? d(r.expires_at) : 'Χωρίς λήξη', status: r.status ?? '' }));
      const active = ((data ?? []) as any[]).filter((r) => r.status === 'active');
      return { columns: [{ key: 'date', label: 'Ημερομηνία' }, { key: 'project', label: 'Έργο' }, { key: 'unit', label: 'Μονάδα' }, { key: 'buyer', label: 'Αγοραστής' }, { key: 'deposit', label: 'Προκαταβολή', align: 'right' }, { key: 'paid', label: 'Πληρώθηκε' }, { key: 'expires', label: 'Λήξη' }, { key: 'status', label: 'Κατάσταση' }], rows,
        summary: [{ label: 'Κρατήσεις', value: String(rows.length) }, { label: 'Ενεργές', value: String(active.length) }, { label: 'Προκαταβολές ενεργών', value: eur(active.reduce((s, r) => s + Number(r.deposit_amount ?? 0), 0)) }] };
    }
    case 'commissions': {
      const { data } = await supabase.from('commissions').select('amount, base_value, commission_pct, status, paid_at, created_at, profiles:profile_id(full_name)').order('created_at', { ascending: false });
      const rows = ((data ?? []) as any[]).map((c) => ({ date: d(c.created_at), agent: c.profiles?.full_name ?? '—', base: eur(Number(c.base_value ?? 0)), pct: c.commission_pct != null ? `${c.commission_pct}%` : '', amount: eur(Number(c.amount ?? 0)), status: c.status === 'paid' ? 'Πληρωμένη' : c.status ?? '', paid: d(c.paid_at) }));
      const all = ((data ?? []) as any[]); const paid = all.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount ?? 0), 0); const tot = all.reduce((s, c) => s + Number(c.amount ?? 0), 0);
      return { columns: [{ key: 'date', label: 'Ημερομηνία' }, { key: 'agent', label: 'Πωλητής' }, { key: 'base', label: 'Βάση', align: 'right' }, { key: 'pct', label: '%', align: 'right' }, { key: 'amount', label: 'Προμήθεια', align: 'right' }, { key: 'status', label: 'Κατάσταση' }, { key: 'paid', label: 'Πληρώθηκε' }], rows,
        summary: [{ label: 'Σύνολο', value: eur(tot) }, { label: 'Πληρωμένες', value: eur(paid) }, { label: 'Εκκρεμούν', value: eur(tot - paid) }] };
    }
    case 'invoices': {
      const { data } = await supabase.from('invoices').select('number, kind, issue_date, due_date, customer_name, net_total, vat_total, total, status').order('issue_date', { ascending: false });
      const rows = ((data ?? []) as any[]).map((i) => ({ number: i.number ?? '', kind: i.kind ?? '', date: d(i.issue_date), due: d(i.due_date), customer: i.customer_name ?? '', net: eur(Number(i.net_total ?? 0)), vat: eur(Number(i.vat_total ?? 0)), total: eur(Number(i.total ?? 0)), status: i.status ?? '' }));
      const all = ((data ?? []) as any[]);
      return { columns: [{ key: 'number', label: 'Αριθμός' }, { key: 'kind', label: 'Είδος' }, { key: 'date', label: 'Έκδοση' }, { key: 'due', label: 'Λήξη' }, { key: 'customer', label: 'Πελάτης' }, { key: 'net', label: 'Καθαρό', align: 'right' }, { key: 'vat', label: 'ΦΠΑ', align: 'right' }, { key: 'total', label: 'Σύνολο', align: 'right' }, { key: 'status', label: 'Κατάσταση' }], rows,
        summary: [{ label: 'Παραστατικά', value: String(rows.length) }, { label: 'Καθαρό', value: eur(all.reduce((s, i) => s + Number(i.net_total ?? 0), 0)) }, { label: 'ΦΠΑ', value: eur(all.reduce((s, i) => s + Number(i.vat_total ?? 0), 0)) }, { label: 'Σύνολο', value: eur(all.reduce((s, i) => s + Number(i.total ?? 0), 0)) }] };
    }
    case 'maintenance': {
      const { data } = await supabase.from('maintenance_tickets').select('title, category, priority, status, created_at, resolved_at, units(unit_number), projects(name)').order('created_at', { ascending: false });
      const rows = ((data ?? []) as any[]).map((t) => ({ date: d(t.created_at), project: t.projects?.name ?? '', unit: t.units?.unit_number ?? '', title: t.title ?? '', category: t.category ?? '', priority: t.priority ?? '', status: t.status ?? '', resolved: d(t.resolved_at) }));
      const open = ((data ?? []) as any[]).filter((t) => !['closed', 'resolved', 'cancelled'].includes(t.status)).length;
      return { columns: [{ key: 'date', label: 'Ημερομηνία' }, { key: 'project', label: 'Έργο' }, { key: 'unit', label: 'Μονάδα' }, { key: 'title', label: 'Αίτημα' }, { key: 'category', label: 'Κατηγορία' }, { key: 'priority', label: 'Προτεραιότητα' }, { key: 'status', label: 'Κατάσταση' }, { key: 'resolved', label: 'Επιλύθηκε' }], rows,
        summary: [{ label: 'Αιτήματα', value: String(rows.length) }, { label: 'Ανοιχτά', value: String(open) }, { label: 'Κλειστά', value: String(rows.length - open) }] };
    }
    case 'activities': {
      const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
      const [{ data: tasks }, { data: ppl }] = await Promise.all([
        supabase.from('follow_up_tasks').select('assigned_to, is_done, due_at, done_at').or(`is_done.eq.false,done_at.gte.${since30}`),
        supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']),
      ]);
      const name = new Map(((ppl ?? []) as any[]).map((p) => [p.id, p.full_name]));
      const m = new Map<string, { open: number; late: number; done: number }>();
      const now = Date.now();
      for (const t of (tasks ?? []) as any[]) { const k = t.assigned_to ?? 'none'; const x = m.get(k) ?? { open: 0, late: 0, done: 0 }; if (t.is_done) x.done++; else { x.open++; if (t.due_at && new Date(t.due_at).getTime() < now) x.late++; } m.set(k, x); }
      const rows = Array.from(m.entries()).map(([k, x]) => ({ user: k === 'none' ? 'Χωρίς υπεύθυνο' : name.get(k) ?? '—', open: x.open, late: x.late, done: x.done })).sort((a, b) => b.open - a.open);
      return { columns: [{ key: 'user', label: 'Χρήστης' }, { key: 'open', label: 'Ανοιχτές', align: 'right' }, { key: 'late', label: 'Καθυστερημένες', align: 'right' }, { key: 'done', label: 'Ολοκληρωμένες (30 ημ.)', align: 'right' }], rows,
        summary: [{ label: 'Ανοιχτές', value: String(rows.reduce((s, r) => s + r.open, 0)) }, { label: 'Καθυστερημένες', value: String(rows.reduce((s, r) => s + r.late, 0)) }, { label: 'Ολοκληρωμένες (30 ημ.)', value: String(rows.reduce((s, r) => s + r.done, 0)) }] };
    }
    case 'leave': {
      const { data } = await supabase.from('leave_requests').select('leave_type, start_date, end_date, days, status, created_at, profiles!leave_requests_profile_id_fkey(full_name)').order('start_date', { ascending: false });
      const ST: Record<string, string> = { pending: 'Σε αναμονή', approved: 'Εγκρίθηκε', rejected: 'Απορρίφθηκε', cancelled: 'Ακυρώθηκε' };
      const rows = ((data ?? []) as any[]).map((l) => ({ employee: l.profiles?.full_name ?? '—', type: l.leave_type ?? '', from: d(l.start_date), to: d(l.end_date), days: l.days ?? '', status: ST[l.status] ?? l.status ?? '' }));
      const approved = ((data ?? []) as any[]).filter((l) => l.status === 'approved').reduce((s, l) => s + Number(l.days ?? 0), 0);
      return { columns: [{ key: 'employee', label: 'Υπάλληλος' }, { key: 'type', label: 'Τύπος' }, { key: 'from', label: 'Από' }, { key: 'to', label: 'Έως' }, { key: 'days', label: 'Ημέρες', align: 'right' }, { key: 'status', label: 'Κατάσταση' }], rows,
        summary: [{ label: 'Αιτήματα', value: String(rows.length) }, { label: 'Σε αναμονή', value: String(((data ?? []) as any[]).filter((l) => l.status === 'pending').length) }, { label: 'Εγκεκριμένες ημέρες', value: String(approved) }] };
    }
    default:
      return null;
  }
}
