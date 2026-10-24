'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { updateParcel } from '@/app/actions/acquisitions';
import type { ParcelItem } from '@/lib/acquisitions-shared';

const ACCESS = ['none', 'track', 'paved', 'main_road'];
const SHAPES = ['regular', 'irregular', 'narrow', 'triangular'];

/** Edit land attributes, seller profile and valuation. Saving re-drives the
 *  land score + uplift (recomputed server-side on refresh). */
export function ParcelEditor({ parcel }: { parcel: ParcelItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [s, setS] = useState({
    location_quality: parcel.locationQuality ?? '', planning_uplift: parcel.planningUplift ?? '', frontage_m: parcel.frontageM ?? '',
    access_quality: parcel.accessQuality ?? '', plot_shape: parcel.plotShape ?? '', density_potential: parcel.densityPotential ?? '',
    seller_urgency: parcel.sellerUrgency ?? '', flexibility: parcel.flexibility ?? '', reason_for_selling: parcel.reasonForSelling ?? '', timeline_to_sell: parcel.timelineToSell ?? '',
    financial_pressure: parcel.financialPressure, inheritance: parcel.inheritance, family_split: parcel.familySplit,
    relocation: parcel.relocation, divorce: parcel.divorce, debt_pressure: parcel.debtPressure,
    current_value: parcel.currentValue ?? '', post_planning_value: parcel.postPlanningValue ?? '', asking_price: parcel.askingPrice ?? '', offer_amount: parcel.offerAmount ?? '',
    latitude: parcel.latitude ?? '', longitude: parcel.longitude ?? '',
  });
  const num = (v: any) => (v === '' || v == null ? null : Number(v));

  const save = () => start(async () => {
    await updateParcel(parcel.id, {
      location_quality: num(s.location_quality), planning_uplift: num(s.planning_uplift), frontage_m: num(s.frontage_m),
      access_quality: s.access_quality || null, plot_shape: s.plot_shape || null, density_potential: num(s.density_potential),
      seller_urgency: num(s.seller_urgency), flexibility: num(s.flexibility), reason_for_selling: s.reason_for_selling || null, timeline_to_sell: s.timeline_to_sell || null,
      financial_pressure: s.financial_pressure, inheritance: s.inheritance, family_split: s.family_split,
      relocation: s.relocation, divorce: s.divorce, debt_pressure: s.debt_pressure,
      current_value: num(s.current_value), post_planning_value: num(s.post_planning_value), asking_price: num(s.asking_price), offer_amount: num(s.offer_amount),
      latitude: num(s.latitude), longitude: num(s.longitude),
    });
    setDone(true); setTimeout(() => setDone(false), 2500); router.refresh();
  });

  const inp = 'w-full rounded-lg border border-stone-line bg-white px-2.5 py-1.5 text-sm focus-visible:border-forest focus-visible:outline-none';
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (<label className="block"><span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-charcoal-600/55">{label}</span>{children}</label>);
  const Num = (k: keyof typeof s, ph = '') => <input type="number" value={s[k] as any} onChange={(e) => setS({ ...s, [k]: e.target.value })} placeholder={ph} className={inp} />;
  type BoolKey = 'financial_pressure' | 'inheritance' | 'family_split' | 'relocation' | 'divorce' | 'debt_pressure';
  const Chk = (k: BoolKey, label: string) => (
    <button type="button" onClick={() => setS({ ...s, [k]: !s[k] })} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${s[k] ? 'bg-forest text-white' : 'bg-sand-100 text-charcoal-600/70 hover:bg-sand-100/70'}`}>{label}</button>
  );

  return (
    <div className="panel space-y-5 p-6">
      <div>
        <h4 className="mb-3 text-charcoal">Land attributes</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Location (1–10)">{Num('location_quality')}</Field>
          <Field label="Planning uplift (1–10)">{Num('planning_uplift')}</Field>
          <Field label="Density (1–10)">{Num('density_potential')}</Field>
          <Field label="Frontage (m)">{Num('frontage_m')}</Field>
          <Field label="Access"><select value={s.access_quality} onChange={(e) => setS({ ...s, access_quality: e.target.value })} className={`${inp} capitalize`}><option value="">—</option>{ACCESS.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}</select></Field>
          <Field label="Plot shape"><select value={s.plot_shape} onChange={(e) => setS({ ...s, plot_shape: e.target.value })} className={`${inp} capitalize`}><option value="">—</option>{SHAPES.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-charcoal">Seller profile</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Urgency (1–10)">{Num('seller_urgency')}</Field>
          <Field label="Flexibility (1–10)">{Num('flexibility')}</Field>
          <Field label="Timeline to sell"><select value={s.timeline_to_sell} onChange={(e) => setS({ ...s, timeline_to_sell: e.target.value })} className={inp}><option value="">—</option><option value="asap">ASAP</option><option value="3_months">3 months</option><option value="6_months">6 months</option><option value="12_months">12 months</option><option value="flexible">Flexible</option></select></Field>
          <Field label="Reason for selling"><input value={s.reason_for_selling} onChange={(e) => setS({ ...s, reason_for_selling: e.target.value })} className={inp} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{Chk('financial_pressure', 'Financial pressure')}{Chk('debt_pressure', 'Debt pressure')}{Chk('inheritance', 'Inheritance')}{Chk('family_split', 'Family dispute')}{Chk('divorce', 'Divorce')}{Chk('relocation', 'Relocation')}</div>
      </div>

      <div>
        <h4 className="mb-3 text-charcoal">Valuation</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Current €">{Num('current_value')}</Field>
          <Field label="Post-planning €">{Num('post_planning_value')}</Field>
          <Field label="Asking €">{Num('asking_price')}</Field>
          <Field label="Offer €">{Num('offer_amount')}</Field>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-charcoal">Map location</h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">{Num('latitude', '34.77')}</Field>
          <Field label="Longitude">{Num('longitude', '32.42')}</Field>
        </div>
      </div>

      <button onClick={save} disabled={pending} className="flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? <Loader2 size={15} className="animate-spin" /> : done ? <><Check size={15} /> Saved</> : 'Save & re-score'}
      </button>
    </div>
  );
}
