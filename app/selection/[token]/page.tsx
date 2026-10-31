import { notFound } from 'next/navigation';
import { BedDouble, Bath, Ruler, MapPin } from 'lucide-react';
import { loadSelection } from '@/lib/selection';
import { InterestButton } from '@/components/map/InterestButton';
import { formatCurrency } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Public page a client opens from «Αποστολή επιλογής» — no sign-in. */
export default async function SelectionPage({ params }: { params: { token: string } }) {
  const sel = await loadSelection(params.token, { countView: true });
  if (!sel) notFound();
  const el = sel.lang === 'el';
  const T = el
    ? { title: 'Ακίνητα για εσάς', from: 'από', expired: 'Αυτός ο σύνδεσμος έληξε. Επικοινωνήστε μαζί μας για ενημερωμένη επιλογή.', sold: 'Δεν είναι πλέον διαθέσιμο', beds: 'υπνοδωμάτια', map: 'Χάρτης', rooms: 'Χώροι' }
    : { title: 'Properties for you', from: 'from', expired: 'This link has expired. Please contact us for an updated selection.', sold: 'No longer available', beds: 'bedrooms', map: 'Map', rooms: 'Rooms' };

  return (
    <div className="min-h-screen bg-stone px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="text-center">
          {sel.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={sel.logo} alt={sel.company} className="mx-auto mb-3 h-12 w-auto object-contain" />
            : <p className="font-display text-2xl text-forest">{sel.company}</p>}
          <h1 className="font-display text-3xl text-charcoal">{T.title}{sel.firstName ? `, ${sel.firstName}` : ''}</h1>
          {sel.agent && <p className="mt-1 text-sm text-charcoal-600">{T.from} {sel.agent}</p>}
          {sel.message && <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm text-charcoal-600">{sel.message}</p>}
        </header>

        {sel.expired ? (
          <p className="panel p-6 text-center text-sm text-charcoal-600">{T.expired}</p>
        ) : (
          sel.units.map((u) => (
            <article key={u.id} className="panel overflow-hidden p-0">
              {u.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.cover} alt="" className="aspect-[16/9] w-full object-cover" />
              )}
              <div className="space-y-3 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{u.project}</p>
                    <h2 className="font-display text-2xl text-charcoal">{u.type ? `${u.type} ` : ''}{u.unitNumber}</h2>
                    {u.location && <p className="flex items-center gap-1 text-sm text-charcoal-600"><MapPin size={13} /> {u.location}</p>}
                  </div>
                  <p className="figure text-2xl text-forest">{u.price != null ? formatCurrency(u.price) : ''}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-charcoal-600">
                  {u.bedrooms != null && <span className="flex items-center gap-1"><BedDouble size={14} /> {u.bedrooms} {T.beds}</span>}
                  {u.bathrooms != null && <span className="flex items-center gap-1"><Bath size={14} /> {u.bathrooms}</span>}
                  {u.sqm != null && <span className="flex items-center gap-1"><Ruler size={14} /> {u.sqm} m²</span>}
                </div>
                {u.description && <p className="whitespace-pre-line text-sm text-charcoal-600">{u.description}</p>}
                {u.facts.length > 0 && (
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {u.facts.map((f) => <div key={f.label} className="flex justify-between border-b border-stone-line py-1"><dt className="text-charcoal-600">{f.label}</dt><dd className="text-charcoal">{f.value}</dd></div>)}
                  </dl>
                )}
                {u.rooms.length > 0 && <p className="text-xs text-charcoal-600">{T.rooms}: {u.rooms.join(' · ')}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  {u.available ? <InterestButton token={params.token} unitId={u.id} lang={sel.lang} already={u.interested} /> : <span className="badge-neutral">{T.sold}</span>}
                  {u.mapUrl && <a href={u.mapUrl} target="_blank" rel="noreferrer" className="text-sm text-forest hover:underline">{T.map}</a>}
                </div>
              </div>
            </article>
          ))
        )}
        <p className="text-center text-[11px] text-charcoal-600/60">{sel.company}</p>
      </div>
    </div>
  );
}
