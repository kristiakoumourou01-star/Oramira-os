'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Smartphone, Trash2, Laptop } from 'lucide-react';
import { startTotpEnroll, confirmTotpEnroll, removeTotp, forgetDevice } from '@/app/actions/mfa';
import { formatDate, formatDateTime } from '@/lib/format';

interface Factor { id: string; name: string | null; createdAt: string }
interface Device { id: string; label: string | null; ip: string | null; createdAt: string; lastUsedAt: string; expiresAt: string; current: boolean }

/** Account → Ασφάλεια: add/remove the authenticator app, see and forget trusted devices. */
export function TwoFactorSetup({ factors, devices, mandatory, rememberAllowed, home }: {
  factors: Factor[]; devices: Device[]; mandatory: boolean; rememberAllowed: boolean; home: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [done, setDone] = useState(false);
  const on = factors.length > 0;

  const begin = () => start(async () => {
    setErr(null);
    const r = await startTotpEnroll();
    if (r.ok) setEnroll({ factorId: r.factorId, qr: r.qr, secret: r.secret }); else setErr(r.error);
  });
  const confirm = () => start(async () => {
    if (!enroll) return;
    const r = await confirmTotpEnroll(enroll.factorId, code);
    if (r.ok) { setEnroll(null); setCode(''); setDone(true); router.refresh(); } else setErr(r.error);
  });
  const remove = (id: string) => {
    if (!window.confirm('Απενεργοποίηση του κωδικού μίας χρήσης;')) return;
    start(async () => { const r = await removeTotp(id); if (r.ok) router.refresh(); else setErr(r.error); });
  };
  const forget = (id?: string) => start(async () => { await forgetDevice(id); router.refresh(); });

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-6">
        <h4 className="flex items-center gap-2"><ShieldCheck size={16} className={on ? 'text-signal-success' : 'text-charcoal-600/50'} /> Κωδικός μίας χρήσης (2FA)</h4>
        {on ? (
          <>
            <p className="text-sm text-signal-success">Ενεργός. Σε κάθε σύνδεση, μετά τον κωδικό σας, γράφετε τον 6ψήφιο κωδικό από την εφαρμογή του κινητού.</p>
            {factors.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border border-stone-line px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><Smartphone size={14} /> Εφαρμογή επαλήθευσης · από {formatDate(f.createdAt)}</span>
                {!mandatory && <button type="button" disabled={pending} onClick={() => remove(f.id)} className="text-xs text-charcoal-600/60 hover:text-signal-danger">Απενεργοποίηση</button>}
              </div>
            ))}
            {done && <a href={home} className="btn-primary w-full justify-center">Συνέχεια</a>}
          </>
        ) : enroll ? (
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-charcoal-600">
              <li>Εγκαταστήστε στο κινητό το <b>Google Authenticator</b> ή το <b>Microsoft Authenticator</b> (δωρεάν).</li>
              <li>Πατήστε «+» και σκανάρετε αυτό τον κωδικό:</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qr} alt="QR για την εφαρμογή επαλήθευσης" className="mx-auto h-48 w-48 rounded bg-white p-2" />
            <p className="text-center text-[11px] text-charcoal-600/70">Δεν σκανάρει; Γράψτε χειροκίνητα: <span className="select-all font-mono text-charcoal">{enroll.secret}</span></p>
            <ol start={3} className="list-decimal pl-5 text-sm text-charcoal-600"><li>Γράψτε τον 6ψήφιο κωδικό που δείχνει η εφαρμογή:</li></ol>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={7} placeholder="000000" className="input text-center font-mono text-lg tracking-[0.3em]" />
              <button type="button" disabled={pending} onClick={confirm} className="btn-primary">{pending ? '…' : 'Ενεργοποίηση'}</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-charcoal-600">Προστατεύει τον λογαριασμό ακόμη κι αν κάποιος μάθει τον κωδικό σας: χρειάζεται και το κινητό σας.</p>
            <button type="button" disabled={pending} onClick={begin} className="btn-primary">{pending ? '…' : 'Ενεργοποίηση 2FA'}</button>
          </>
        )}
        {err && <p className="text-sm text-signal-danger">{err}</p>}
      </div>

      {on && rememberAllowed && (
        <div className="panel space-y-2 p-6">
          <h4 className="flex items-center gap-2"><Laptop size={16} /> Συσκευές που δεν ζητούν κωδικό</h4>
          <p className="text-xs text-charcoal-600/70">Όσες επιλέξατε «Να με θυμάται» κατά τη σύνδεση. Λήγουν μόνες τους μετά από 30 μέρες.</p>
          {devices.length === 0 ? <p className="text-sm text-charcoal-600/70">Καμία.</p> : devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-stone-line px-3 py-2 text-sm">
              <span>
                {d.label ?? 'Συσκευή'}{d.current && <span className="ml-1 text-xs text-forest">(αυτή)</span>}
                <span className="block text-[11px] text-charcoal-600/60">Τελευταία χρήση {formatDateTime(d.lastUsedAt)}{d.ip ? ` · ${d.ip}` : ''} · λήγει {formatDate(d.expiresAt)}</span>
              </span>
              <button type="button" disabled={pending} onClick={() => forget(d.id)} title="Ανάκληση" className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={14} /></button>
            </div>
          ))}
          {devices.length > 1 && <button type="button" disabled={pending} onClick={() => forget()} className="btn-secondary px-3 py-1.5 text-xs">Ανάκληση όλων</button>}
        </div>
      )}

      <a href={home} className="block text-center text-xs text-charcoal-600/70 hover:text-forest">← Πίσω στην εφαρμογή</a>
    </div>
  );
}
