import { Mail, Phone } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-settings';

export const dynamic = 'force-dynamic';

/** Help for buyers, owners, investors and contractors: FAQ, contact, terms (Settings → Portals πελατών). */
export default async function PortalHelpPage() {
  await requireProfile();
  const { portal } = await getOrgSettings();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow mb-1">Help</p>
        <h1 className="font-display text-[26px] leading-tight text-charcoal">How can we help?</h1>
      </div>

      {(portal.helpEmail || portal.helpPhone) && (
        <div className="panel flex flex-wrap gap-6 p-5 text-sm">
          {portal.helpEmail && <a href={`mailto:${portal.helpEmail}`} className="inline-flex items-center gap-2 text-forest hover:underline"><Mail size={15} /> {portal.helpEmail}</a>}
          {portal.helpPhone && <a href={`tel:${portal.helpPhone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-2 text-forest hover:underline"><Phone size={15} /> {portal.helpPhone}</a>}
        </div>
      )}

      {portal.faq.length > 0 && (
        <div className="panel divide-y divide-stone-line">
          {portal.faq.map((f, i) => (
            <details key={i} className="group p-5" open={i === 0}>
              <summary className="cursor-pointer list-none font-medium text-charcoal group-open:text-forest">{f.q}</summary>
              <p className="mt-2 whitespace-pre-line text-sm text-charcoal-600">{f.a}</p>
            </details>
          ))}
        </div>
      )}

      {portal.termsText && (
        <div id="terms" className="panel p-6">
          <h2 className="mb-3 font-display text-xl text-charcoal">Terms of use</h2>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-charcoal-600">{portal.termsText}</div>
        </div>
      )}
    </div>
  );
}
