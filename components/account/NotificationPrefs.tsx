'use client';

import { useEffect, useState, useTransition } from 'react';
import { Switch, SettingsBlock, OptionBox } from '@/components/admin/settings-ui';
import { saveMyNotificationPrefs } from '@/app/actions/tickets';

const PREFS_KEY = 'oramira_notif_prefs';

/** Ο λογαριασμός μου → Ειδοποιήσεις: ήχος και ειδοποίηση επιφάνειας εργασίας (σε αυτή τη συσκευή). */
export function NotificationPrefs({ marketing }: { marketing: { inApp: boolean; email: boolean; push: boolean } }) {
  const [p, setP] = useState({ sound: false, desktop: false });
  const [m, setM] = useState(marketing);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const saveM = () => start(async () => { const r = await saveMyNotificationPrefs(m); setSaved(r.ok ? 'Αποθηκεύτηκε.' : r.error); });
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    try { const x = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); setP({ sound: x.sound === true, desktop: x.desktop === true }); } catch { /* */ }
  }, []);
  const write = (next: { sound: boolean; desktop: boolean }) => { setP(next); try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode */ } };
  const desktop = async (on: boolean) => {
    if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const r = await Notification.requestPermission();
      if (r !== 'granted') { setNote('Ο browser δεν έδωσε άδεια για ειδοποιήσεις. Ενεργοποιήστε τη από τις ρυθμίσεις του browser.'); return; }
    }
    setNote(null); write({ ...p, desktop: on });
  };
  return (
    <div className="space-y-5">
    <SettingsBlock title="Προτιμήσεις ειδοποιήσεων" note="Διαλέξτε από ποια κανάλια δέχεστε ενημερώσεις marketing. Οι ειδοποιήσεις λειτουργίας (ασφάλεια, χρεώσεις, κλείδωμα λογαριασμού) έρχονται πάντα.">
      {([['inApp', 'Marketing μέσα στην εφαρμογή', 'Ενημερώσεις marketing μέσα στην εφαρμογή.'], ['email', 'Marketing email', 'Email για προσφορές και νέα της εταιρείας.'], ['push', 'Marketing push', 'Ειδοποιήσεις push στο κινητό.']] as const).map(([k, title, hint]) => (
        <OptionBox key={k} title={title} hint={hint}>
          <Switch checked={m[k]} label={title} onChange={(x) => { setSaved(null); setM({ ...m, [k]: x }); }} />
        </OptionBox>
      ))}
      <p className="text-xs text-charcoal-600/70">Οι ειδοποιήσεις λειτουργίας (ασφάλεια, κλείδωμα, χρεώσεις, υποστήριξη) δεν απενεργοποιούνται.</p>
      <div className="flex items-center gap-3"><button type="button" className="btn-primary" disabled={pending} onClick={saveM}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση προτιμήσεων'}</button>{saved && <span className="text-sm text-charcoal-600">{saved}</span>}</div>
    </SettingsBlock>
    <SettingsBlock title="Σε αυτή τη συσκευή" note="Προσωπικό — ισχύει μόνο σε αυτή τη συσκευή. Ποιες ειδοποιήσεις στέλνονται το ορίζει ο διαχειριστής στο Settings → Ειδοποιήσεις.">
      <OptionBox title="Ήχος" hint="Ένα σύντομο «ντινγκ» όταν έρθει νέα ειδοποίηση.">
        <Switch checked={p.sound} label="Ήχος ειδοποιήσεων" onChange={(x) => write({ ...p, sound: x })} />
      </OptionBox>
      <OptionBox title="Ειδοποίηση στην οθόνη" hint="Εμφανίζεται ακόμη κι αν είστε σε άλλη καρτέλα.">
        <Switch checked={p.desktop} label="Ειδοποίηση στην οθόνη" onChange={desktop} />
      </OptionBox>
      {note && <p className="text-sm text-signal-danger">{note}</p>}
    </SettingsBlock>
    </div>
  );
}
