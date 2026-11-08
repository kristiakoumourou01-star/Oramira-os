import Link from 'next/link';
import { Smartphone, Apple, Bell, Users } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-settings';
import { CopyLink } from '@/components/admin/CopyLink';

export const dynamic = 'force-dynamic';

/**
 * Admin → Mobile app: η εφαρμογή εγκαθίσταται στο κινητό από τον browser
 * (χωρίς App Store, δωρεάν). Το ίδιο link για προσωπικό και πελάτες — ο καθένας
 * βλέπει ό,τι του επιτρέπει ο ρόλος του.
 */
export default async function MobileAppPage() {
  await requirePermission('users');
  const { communication, portal } = await getOrgSettings();
  const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://oramira-os-3mbm.vercel.app').replace(/\/$/, '');
  const steps = [
    { icon: Apple, title: 'iPhone / iPad', items: ['Ανοίξτε το link στο Safari.', 'Πατήστε «Κοινοποίηση» (το τετράγωνο με το βέλος).', 'Επιλέξτε «Προσθήκη στην οθόνη Αφετηρίας».'] },
    { icon: Smartphone, title: 'Android', items: ['Ανοίξτε το link στο Chrome.', 'Πατήστε το μενού ⋮ πάνω δεξιά.', 'Επιλέξτε «Εγκατάσταση εφαρμογής» ή «Προσθήκη στην αρχική οθόνη».'] },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-charcoal">Mobile app</h2>
        <p className="text-sm text-charcoal-600/75">Η εφαρμογή μπαίνει στο κινητό σαν κανονική εφαρμογή, με εικονίδιο στην αρχική οθόνη — χωρίς App Store και χωρίς κόστος.</p>
      </div>

      <div className="panel space-y-3 p-5">
        <p className="font-semibold text-charcoal">Link εγκατάστασης</p>
        <p className="text-sm text-charcoal-600/75">Στείλτε το στο προσωπικό και στους πελάτες. Ο καθένας συνδέεται με το δικό του email και βλέπει μόνο ό,τι του επιτρέπει ο ρόλος του (προσωπικό → εφαρμογή, αγοραστές / ιδιοκτήτες / επενδυτές / εργολάβοι → το portal τους).</p>
        <CopyLink url={url} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {steps.map((s) => (
          <div key={s.title} className="panel space-y-3 p-5">
            <p className="flex items-center gap-2 font-semibold text-charcoal"><s.icon size={17} /> {s.title}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-charcoal">{s.items.map((i) => <li key={i}>{i}</li>)}</ol>
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="panel space-y-2 p-5">
          <p className="flex items-center gap-2 font-semibold text-charcoal"><Bell size={17} /> Push ειδοποιήσεις</p>
          <p className="text-sm text-charcoal-600/75">{communication.pushEnabled ? 'Ενεργοποιημένες στις ρυθμίσεις — θα στέλνονται μόλις συνδεθεί ο πάροχος push.' : 'Απενεργοποιημένες.'}</p>
          <Link href="/settings?section=communication" className="btn-secondary text-sm">Επικοινωνία</Link>
        </div>
        <div className="panel space-y-2 p-5">
          <p className="flex items-center gap-2 font-semibold text-charcoal"><Users size={17} /> Portal πελατών</p>
          <p className="text-sm text-charcoal-600/75">Όροι χρήσης, συχνές ερωτήσεις ({portal.faq.length}) και στοιχεία υποστήριξης που βλέπουν οι πελάτες στην εφαρμογή.</p>
          <Link href="/settings?section=portals" className="btn-secondary text-sm">Portals πελατών</Link>
        </div>
      </div>
    </div>
  );
}
