'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { setProjectLocation } from '@/app/actions/unit-page';

/** Χάρτης του έργου (OpenStreetMap), με ορισμό τοποθεσίας από συντεταγμένες ή σύνδεσμο Google Maps. */
export function LocationCard({ projectId, projectName, location, lat: lat0, lng: lng0, approx, canEdit, back }: { projectId: string; projectName: string; location: string | null; lat: number | null; lng: number | null; approx?: { lat: number; lng: number } | null; canEdit: boolean; back: string }) {
  const guessed = (lat0 == null || lng0 == null) && !!approx;
  const lat = lat0 ?? approx?.lat ?? null; const lng = lng0 ?? approx?.lng ?? null;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(lat0 != null && lng0 != null ? `${lat0}, ${lng0}` : '');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const has = lat != null && lng != null;
  const d = guessed ? 0.02 : 0.006;
  const embed = has ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng! - d}%2C${lat! - d}%2C${lng! + d}%2C${lat! + d}&layer=mapnik${guessed ? '' : `&marker=${lat}%2C${lng}`}` : null;
  const save = () => start(async () => {
    const r = await setProjectLocation(projectId, input, back);
    if (r.ok) { setEditing(false); setErr(null); router.refresh(); } else setErr(r.error);
  });

  return (
    <div className="panel space-y-3 p-6">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2"><MapPin size={15} className="text-olive" /> Τοποθεσία</h4>
        {canEdit && !editing && <button type="button" onClick={() => setEditing(true)} className="text-xs text-forest hover:underline">{has && !guessed ? 'Αλλαγή' : 'Ορισμός ακριβούς θέσης'}</button>}
      </div>
      {location && <p className="text-sm text-charcoal-600">{projectName} · {location}</p>}
      {embed ? (
        <>
          <iframe src={embed} title={`Χάρτης ${projectName}`} className="h-56 w-full rounded-md border border-stone-line" loading="lazy" />
          {guessed && <p className="text-[11px] text-charcoal-600/70">Κατά προσέγγιση, από τη διεύθυνση «{location}». Ορίστε την ακριβή θέση για καρφίτσα στο οικόπεδο.</p>}
          <div className="flex gap-3 text-xs">
            <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="text-forest hover:underline">Google Maps</a>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer" className="text-forest hover:underline">Οδηγίες</a>
          </div>
        </>
      ) : !editing && <p className="text-sm text-charcoal-600/70">Δεν έχει οριστεί ακόμη η θέση του έργου στον χάρτη.</p>}
      {editing && (
        <div className="space-y-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} className="input text-sm" placeholder="34.6786, 33.0413 — ή σύνδεσμος Google Maps" />
          <p className="text-[11px] text-charcoal-600/60">Στο Google Maps: δεξί κλικ στο σημείο → πατήστε τις συντεταγμένες για αντιγραφή, και επικολλήστε εδώ. Ισχύει για όλες τις μονάδες του έργου.</p>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={save} className="btn-primary px-3 py-1.5 text-xs">Αποθήκευση</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary px-3 py-1.5 text-xs">Άκυρο</button>
          </div>
          {err && <p className="text-xs text-signal-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}
