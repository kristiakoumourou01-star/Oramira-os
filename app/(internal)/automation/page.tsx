import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { JOBS } from '@/lib/automations';
import { AutomationHub, type AutoJob, type AutoRun } from '@/components/automation/AutomationHub';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

export const dynamic = 'force-dynamic';

const CATEGORY: Record<string, string> = {
  crm: 'Πωλήσεις', speed_to_lead: 'Πωλήσεις', sales_cadence: 'Πωλήσεις', lead_digest: 'Πωλήσεις', dead_lead_reactivation: 'Πωλήσεις', viewing_reminders: 'Πωλήσεις', meeting_reminders: 'Πωλήσεις', churn_detection: 'Πωλήσεις',
  acquisition_ops: 'Αγορές γης', acquisition_cadence: 'Αγορές γης',
  maintenance: 'Ακίνητα', warranty_expiry: 'Ακίνητα', reservation_expiry: 'Ακίνητα', owner_lifecycle: 'Ακίνητα',
  contract_reminders: 'Ομάδα & HR',
  payment_reminders: 'Οικονομικά',
  task_orchestration: 'AI', self_healing: 'AI', learning_loop: 'AI', executive_memory: 'AI',
  website_sync: 'Σύστημα', auto_calendar_events: 'Σύστημα', gdpr_retention: 'Σύστημα',
};
const ORDER = ['Πωλήσεις', 'Αγορές γης', 'Ακίνητα', 'Ομάδα & HR', 'Οικονομικά', 'AI', 'Σύστημα'];
const EL: Record<string, [string, string]> = {
  reservation_expiry: ['Λήξη κρατήσεων', 'Αποδεσμεύει μονάδες από κρατήσεις που έληξαν και ειδοποιεί την ομάδα.'],
  warranty_expiry: ['Λήξη εγγυήσεων', 'Υπενθυμίζει σε ιδιοκτήτες και ομάδα εγγυήσεις που λήγουν μέσα σε 60 μέρες.'],
  payment_reminders: ['Υπενθυμίσεις πληρωμών', 'Υπενθυμίσεις για επερχόμενες δόσεις και ειδοποιήσεις για καθυστερήσεις.'],
  website_sync: ['Συγχρονισμός ιστοσελίδας', 'Περνά στο CRM ό,τι ήρθε από τη φόρμα της ιστοσελίδας ή το newsletter.'],
  maintenance: ['Συντήρηση', 'Υπενθυμίσεις επισκέψεων, καθυστερήσεις και κλιμάκωση ανοιχτών αιτημάτων.'],
  crm: ['Follow-ups CRM', 'Υπενθυμίσεις για ανενεργά leads, στάδια που καθυστερούν και leads υψηλής αξίας.'],
  contract_reminders: ['Υπενθυμίσεις συμβάσεων', 'Ειδοποιεί πριν λήξουν συμβάσεις, δοκιμαστικές περίοδοι και ανανεώσεις υπαλλήλων.'],
  viewing_reminders: ['Υπενθυμίσεις viewings', 'Στέλνει WhatsApp υπενθύμιση για viewings των επόμενων 24 ωρών.'],
  meeting_reminders: ['Υπενθυμίσεις ραντεβού', 'Στέλνει WhatsApp υπενθύμιση για ραντεβού με leads των επόμενων 2 ωρών.'],
  dead_lead_reactivation: ['Επανενεργοποίηση leads', 'Leads χωρίς κίνηση πάνω από 30 μέρες μπαίνουν σε επανενεργοποίηση με WhatsApp και email.'],
  auto_calendar_events: ['Αυτόματα γεγονότα ημερολογίου', 'Βάζει στο ημερολόγιο λήξεις συμβάσεων/εγγυήσεων, viewings και προθεσμίες μισθοδοσίας.'],
  churn_detection: ['Εντοπισμός κινδύνου', 'Σημαδεύει deals σε κίνδυνο, διαπραγματεύσεις που σταμάτησαν και ανενεργούς ιδιοκτήτες.'],
  owner_lifecycle: ['Κύκλος ιδιοκτήτη', 'Follow-up μετά από επισκευή, ετήσιες επιθεωρήσεις και επέτειος παράδοσης.'],
  task_orchestration: ['Αυτόματες εργασίες', 'Δημιουργεί εργασίες για ζεστά leads, κολλημένα deals, απλήρωτες κρατήσεις και καθυστερημένα follow-ups.'],
  self_healing: ['Αυτο-διόρθωση διαδικασιών', 'Εντοπίζει follow-ups που λείπουν, χαρτιά που δεν ολοκληρώθηκαν, παραδόσεις και τιμολόγια που καθυστερούν.'],
  learning_loop: ['Μάθηση από αποτελέσματα', 'Μαθαίνει από τα κερδισμένα/χαμένα deals για καλύτερο scoring και follow-up.'],
  executive_memory: ['Μνήμη διοίκησης', 'Κρατά αυτόματα τα κερδισμένα/χαμένα deals και τις σημαντικές αποφάσεις.'],
  acquisition_cadence: ['Follow-up αγορών γης', 'Υπενθυμίζει σε ιδιοκτήτες γης που δεν απαντούν, με WhatsApp/email και εργασία για τηλέφωνο.'],
  gdpr_retention: ['Διατήρηση δεδομένων (GDPR)', 'Ανωνυμοποιεί leads χωρίς δραστηριότητα πέρα από την περίοδο διατήρησης.'],
  acquisition_ops: ['Λειτουργίες αγορών γης', 'Εργασίες follow-up, ειδοποιήσεις χωρίς επαφή, προθεσμίες due diligence και αιτήματα εγγράφων.'],
};
const SCHED: Record<string, string> = { 'Hourly': 'Κάθε ώρα', 'Daily': 'Καθημερινά', 'Every 15 min': 'Κάθε 15 λεπτά', 'Every 6 hours': 'Κάθε 6 ώρες', 'Every 5 min': 'Κάθε 5 λεπτά', 'Every 2 hours': 'Κάθε 2 ώρες' };

/** Αυτοματισμοί στο στυλ του FitnessCRM. */
export default async function AutomationCenterPage() {
  await requirePermission('automation');
  const supabase = await createSupabaseServerClient();
  const { data: runRows } = await supabase.from('automation_runs').select('id, job, status, processed, summary, error, triggered_by, started_at').order('started_at', { ascending: false }).limit(500);
  const label = (k: string) => EL[k]?.[0] ?? JOBS.find((j) => j.key === k)?.label ?? k;
  const runs: AutoRun[] = ((runRows ?? []) as any[]).map((r) => ({ id: r.id, job: r.job, label: label(r.job), status: r.status, processed: r.processed ?? 0, summary: r.summary, error: r.error, trigger: r.triggered_by, at: r.started_at }));
  const last = new Map<string, AutoRun>();
  for (const r of runs) if (!last.has(r.job)) last.set(r.job, r);
  const jobs: AutoJob[] = JOBS.map((j) => ({
    key: j.key, label: label(j.key), description: EL[j.key]?.[1] ?? j.description, schedule: SCHED[j.schedule] ?? j.schedule, category: CATEGORY[j.key] ?? 'Σύστημα',
    lastStatus: last.get(j.key)?.status ?? null, lastAt: last.get(j.key)?.at ?? null, lastSummary: last.get(j.key)?.summary ?? null,
  }));
  const categories = ORDER.filter((c) => jobs.some((j) => j.category === c));
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Marketing" title="Αυτοματισμοί" description={`${jobs.length} αυτοματισμοί σε ${categories.length} κατηγορίες — follow-ups, υπενθυμίσεις, λήξεις και εργασίες που τρέχουν μόνες τους.`} />
      <AutomationHub jobs={jobs} runs={runs} categories={categories} />
    </div>
  );
}
