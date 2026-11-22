import { activeToken } from '@/lib/calendar-sync';

/**
 * Αποστολή email από τον λογαριασμό Google του χρήστη (π.χ. info@oramiraltd.com),
 * μέσω της ίδιας σύνδεσης με το Google Calendar. Χρειάζεται ο χρήστης να έχει
 * συνδέσει ξανά το Google ώστε να έχει δοθεί η άδεια «αποστολή email».
 * Επιστρέφει false (χωρίς σφάλμα) όταν δεν γίνεται — τότε δείχνουμε το link.
 */
export async function sendViaGmail(profileId: string, to: string, subject: string, html: string, fromName?: string | null): Promise<boolean> {
  try {
    const t = await activeToken(profileId);
    if (!t) return false;
    const enc = (v: string) => `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;
    // Όνομα αποστολέα: η διεύθυνση μένει του λογαριασμού, αλλάζει μόνο το όνομα που φαίνεται.
    let from: string | null = null;
    if (fromName && fromName.trim()) {
      const p = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { authorization: `Bearer ${t.token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (p?.emailAddress) from = `From: ${enc(fromName.trim())} <${p.emailAddress}>`;
    }
    const mime = [
      ...(from ? [from] : []),
      `To: ${to}`,
      `Subject: ${enc(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
    ].join('\r\n');
    const raw = Buffer.from(mime, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${t.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) { console.error('[gmail]', res.status, (await res.text()).slice(0, 300)); return false; }
    return true;
  } catch (e) {
    console.error('[gmail]', e);
    return false;
  }
}
