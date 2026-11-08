'use client';

import { useEffect, useState } from 'react';
import { Switch, SettingsBlock } from '@/components/admin/settings-ui';

const PREFS_KEY = 'oramira_notif_prefs';

/** Ο λογαριασμός μου → Ειδοποιήσεις: ήχος και ειδοποίηση επιφάνειας εργασίας (σε αυτή τη συσκευή). */
export function NotificationPrefs() {
  const [p, setP] = useState({ sound: false, desktop: false });
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
    <SettingsBlock title="Ειδοποιήσεις" note="Προσωπικό — ισχύει μόνο σε αυτή τη συσκευή. Ποιες ειδοποιήσεις στέλνονται το ορίζει ο διαχειριστής στο Settings → Ειδοποιήσεις.">
      <div className="flex items-center justify-between gap-4">
        <div><p className="font-medium text-charcoal">Ήχος</p><p className="text-sm text-charcoal-600/70">Ένα σύντομο «ντινγκ» όταν έρθει νέα ειδοποίηση.</p></div>
        <Switch checked={p.sound} label="Ήχος ειδοποιήσεων" onChange={(x) => write({ ...p, sound: x })} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div><p className="font-medium text-charcoal">Ειδοποίηση στην οθόνη</p><p className="text-sm text-charcoal-600/70">Εμφανίζεται ακόμη κι αν είστε σε άλλη καρτέλα.</p></div>
        <Switch checked={p.desktop} label="Ειδοποίηση στην οθόνη" onChange={desktop} />
      </div>
      {note && <p className="text-sm text-signal-danger">{note}</p>}
    </SettingsBlock>
  );
}
