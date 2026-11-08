'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Camera, Trash2 } from 'lucide-react';
import { updateMyProfile } from '@/app/actions/account';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FieldLabel } from '@/components/admin/settings-ui';
import { fileToDataUrl } from '@/lib/image-upload';

export interface MyProfile { fullName: string; email: string; phone: string; jobTitle: string; avatarUrl: string | null; roleName: string; department: string }

/** Ο λογαριασμός μου → Πληροφορίες → Προφίλ (επεξεργάσιμο από τον ίδιο). */
export function AccountProfile({ initial, readOnly }: { initial: MyProfile; readOnly: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<MyProfile>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const dirty = v.fullName !== initial.fullName || v.phone !== initial.phone || v.jobTitle !== initial.jobTitle || v.avatarUrl !== initial.avatarUrl;
  const initials = (v.fullName || v.email).split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try { set({ avatarUrl: await fileToDataUrl(f, 256, true) }); } catch (e: any) { setMsg({ ok: false, text: e?.message ?? 'Η εικόνα δεν διαβάστηκε.' }); }
  };
  const save = () => start(async () => {
    const r = await updateMyProfile({ fullName: v.fullName, phone: v.phone, jobTitle: v.jobTitle, ...(v.avatarUrl !== initial.avatarUrl ? { avatarUrl: v.avatarUrl } : {}) });
    setMsg(r.ok ? { ok: true, text: 'Το προφίλ αποθηκεύτηκε.' } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-stone-line px-5 py-3.5"><p className="font-semibold text-charcoal">Προφίλ</p></div>
      <div className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          {v.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={v.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-lg font-semibold text-white">{initials || '?'}</span>}
          <div className="min-w-0">
            <p className="truncate font-display text-lg text-charcoal">{v.fullName || '—'}</p>
            <p className="truncate text-sm text-charcoal-600/75">{[initial.roleName, initial.department].filter(Boolean).join(' · ')}</p>
            {!readOnly && (
              <div className="mt-1 flex gap-3 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-1 text-forest hover:underline"><Camera size={14} /> Αλλαγή φωτογραφίας
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} /></label>
                {v.avatarUrl && <button type="button" onClick={() => set({ avatarUrl: null })} className="inline-flex items-center gap-1 text-charcoal-600/70 hover:text-signal-danger"><Trash2 size={13} /> Αφαίρεση</button>}
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><FieldLabel>Ονοματεπώνυμο</FieldLabel><input className="input" disabled={readOnly} value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} /></label>
          <label className="block"><FieldLabel>Email σύνδεσης</FieldLabel><input className="input" disabled value={v.email} /><span className="mt-1 block text-xs text-charcoal-600/60">Το αλλάζει ο διαχειριστής (Staff → Χρήστες).</span></label>
          <div className="block"><FieldLabel>Κινητό</FieldLabel><PhoneInput value={v.phone} disabled={readOnly} onChange={(x) => set({ phone: x })} /></div>
          <label className="block"><FieldLabel>Θέση</FieldLabel><input className="input" disabled={readOnly} value={v.jobTitle} placeholder="π.χ. Sales agent" onChange={(e) => set({ jobTitle: e.target.value })} /></label>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
            <button type="button" onClick={save} disabled={pending || !dirty} className="btn-primary disabled:opacity-50"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          </div>
        )}
        {readOnly && <p className="text-sm text-charcoal-600/75">Βλέπετε ως άλλος χρήστης — το προφίλ το αλλάζει μόνο ο ίδιος.</p>}
      </div>
    </div>
  );
}
