import { ChevronDown } from 'lucide-react';

const FAQ: { group: string; items: { q: string; a: string }[] }[] = [
  { group: 'Λογαριασμός', items: [
    { q: 'Πώς αλλάζω τον κωδικό μου;', a: 'Ο λογαριασμός μου → Πληροφορίες → Ασφάλεια → «Αλλαγή» δίπλα στον κωδικό.' },
    { q: 'Πώς αλλάζω γλώσσα;', a: 'Από το εικονίδιο πάνω δεξιά ή από Ο λογαριασμός μου → Πληροφορίες → Γλώσσα. Η επιλογή ισχύει μόνο για εσάς.' },
    { q: 'Πώς αποσυνδέομαι;', a: 'Πατήστε τη φωτογραφία σας πάνω δεξιά και επιλέξτε «Αποσύνδεση», ή Ο λογαριασμός μου → Αποσύνδεση.' },
  ] },
  { group: 'Leads & πωλήσεις', items: [
    { q: 'Πού βλέπω τα νέα leads;', a: 'Στα «Νέα leads» κάτω από το Lead management. Πατήστε «Ανάθεση σε μένα» και το lead μπαίνει στο pipeline σας.' },
    { q: 'Πού είναι τα follow-ups μου;', a: 'Στα «Follow-ups»: καθυστερημένα, σήμερα και επόμενα, με κλήση και ολοκλήρωση με ένα κλικ.' },
  ] },
  { group: 'Έργα & μονάδες', items: [
    { q: 'Πώς γίνεται ένα οικόπεδο έργο;', a: 'Αγορά γης → Deal Analyzer → «Μετατροπή σε έργο». Τα στοιχεία της ανάλυσης περνούν στο νέο έργο.' },
    { q: 'Πού βλέπω το ιστορικό μιας μονάδας;', a: 'Στη σελίδα της μονάδας: κράτηση, πώληση, ιδιοκτήτες, ενοικιάσεις, πληρωμές, συντήρηση και έγγραφα.' },
  ] },
  { group: 'Υποστήριξη', items: [
    { q: 'Κάτι δεν δουλεύει — τι κάνω;', a: 'Ανοίξτε ένα ticket από «Τα tickets μου». Ο διαχειριστής ειδοποιείται αμέσως και απαντά εκεί.' },
  ] },
];

const NEWS: { v: string; date: string; title: string; text: string; bullets?: string[] }[] = [
  { v: 'v4.0', date: '21/11/2026', title: 'Νέος λογαριασμός και ρυθμίσεις', text: 'Ο λογαριασμός μου και οι Ρυθμίσεις στήθηκαν από την αρχή, πιο καθαρά.', bullets: ['Tickets υποστήριξης με συνομιλία', 'Συχνές ερωτήσεις', 'Αποσύνδεση από το εικονίδιο πάνω δεξιά'] },
  { v: 'v3.9', date: '21/11/2026', title: 'Τρεις γλώσσες', text: 'Όλη η εφαρμογή σε ελληνικά, αγγλικά και ρώσικα.' },
  { v: 'v3.8', date: '20/11/2026', title: 'Υπάλληλοι', text: 'Καρτέλα υπαλλήλου με ημερομηνία πρόσληψης, λήξη συνεργασίας, συμβάσεις και έγγραφα.' },
  { v: 'v3.7', date: '19/11/2026', title: 'Το χρώμα της εταιρείας παντού', text: 'Ό,τι είναι επιλεγμένο γεμίζει με το χρώμα που διαλέγετε στις Ρυθμίσεις.' },
];

/** Ο λογαριασμός μου → Συχνές ερωτήσεις. */
export function FaqView() {
  return (
    <div className="space-y-4">
      <div><h2 className="font-display text-2xl text-charcoal">Συχνές ερωτήσεις</h2><p className="text-sm text-charcoal-600/75">Γρήγορες απαντήσεις στις πιο συνηθισμένες ερωτήσεις</p></div>
      {FAQ.map((g) => (
        <section key={g.group} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-600/70">{g.group}</p>
          {g.items.map((it) => (
            <details key={it.q} className="group rounded-2xl border border-stone-line bg-white px-4 py-3 shadow-[0_1px_2px_rgba(17,49,36,0.04)] open:border-forest/30">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-charcoal"><span>{it.q}</span><ChevronDown size={16} className="shrink-0 text-charcoal-600 transition group-open:rotate-180 group-open:text-forest" /></summary>
              <p className="mt-2 text-sm text-charcoal-600">{it.a}</p>
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}

/** Ο λογαριασμός μου → Τι νέο. */
export function NewsView() {
  return (
    <div className="space-y-4">
      <div><h2 className="font-display text-2xl text-charcoal">Τι νέο</h2><p className="text-sm text-charcoal-600/75">Πρόσφατες αλλαγές και βελτιώσεις</p></div>
      {NEWS.map((n) => (
        <article key={n.v} className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
          <p className="flex items-center gap-2 text-xs text-charcoal-600/70"><span className="rounded-full bg-forest px-2 py-0.5 font-semibold text-white" data-no-tr>{n.v}</span>{n.date}</p>
          <p className="mt-2 font-semibold text-charcoal">{n.title}</p>
          <p className="text-sm text-charcoal-600">{n.text}</p>
          {n.bullets && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-charcoal-600">{n.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
        </article>
      ))}
    </div>
  );
}
