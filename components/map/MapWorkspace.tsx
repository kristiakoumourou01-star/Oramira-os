'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Crosshair, Send, Route, Users, X, Copy, MessageCircle, Mail, AlertTriangle, MapPin, ChevronRight, ArrowUpRight } from 'lucide-react';
import { scorePropertyMatch, type MatchResult } from '@/lib/matching';
import type { UnitField } from '@/lib/unit-forms-shared';
import { directionsUrl, legBetween, type DayStop, type MapLead, type MapProject, type MapUnit } from '@/lib/map-shared';
import { createSelection, getDayPlan } from '@/app/actions/map';
import { formatCurrency, formatTime } from '@/lib/format';

/* ── Leaflet from a CDN (no npm dependency) ─────────────────────────────── */
const LEAFLET_VER = '1.9.4';
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.css`;
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.js`;
      s.async = true;
      s.onload = () => resolve((window as any).L);
      s.onerror = () => { leafletPromise = null; reject(new Error('Ο χάρτης δεν φόρτωσε (έλεγχος σύνδεσης).')); };
      document.body.appendChild(s);
    });
  }
  return leafletPromise;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const TIER_COLOR = { strong: '#1F6B4A', possible: '#C8A86B', weak: '#9A968E' } as const;
const VIEWING_MIN = 45;

interface Scored { unit: MapUnit; project: MapProject | null; match: MatchResult | null }

export function MapWorkspace({ projects, unplaced, units, leads, fields, agents, me, canLeads, presetLead }: {
  projects: MapProject[];
  unplaced: { id: string; name: string; location: string | null }[];
  units: MapUnit[];
  leads: MapLead[];
  fields: UnitField[];
  agents: { id: string; name: string }[];
  me: string;
  canLeads: boolean;
  presetLead: string | null;
}) {
  const [mode, setMode] = useState<'match' | 'day'>('match');
  const leadLabel = (l: MapLead) => `${l.name}${l.email ? ` — ${l.email}` : ''}`;
  const [leadQ, setLeadQ] = useState(() => { const l = leads.find((x) => x.leadId === presetLead); return l ? leadLabel(l) : ''; });
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [onlyVisible, setOnlyVisible] = useState(false);
  const [openProj, setOpenProj] = useState<Set<string>>(new Set());
  const toggleProj = (id: string) => setOpenProj((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [bounds, setBounds] = useState<{ s: number; w: number; n: number; e: number } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lead = useMemo(() => leads.find((l) => leadLabel(l) === leadQ) ?? leads.find((l) => l.name === leadQ) ?? null, [leads, leadQ]);
  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const scored: Scored[] = useMemo(() => {
    const list = units
      .filter((u) => !onlyAvailable || u.status === 'available')
      .map((u) => {
        const project = projById.get(u.projectId) ?? null;
        const match = lead
          ? scorePropertyMatch(lead.criteria, {
              id: u.id, price: u.price, bedrooms: u.bedrooms, sqm: u.sqm, projectId: u.projectId, status: 'available',
              locationText: project ? [project.location, project.name].filter(Boolean).join(', ') : null,
              lat: project && !project.approx ? project.lat : null, lng: project && !project.approx ? project.lng : null,
              features: u.features,
            }, fields)
          : null;
        return { unit: u, project, match };
      })
      .filter((s) => !onlyVisible || !bounds || (s.project && s.project.lat >= bounds.s && s.project.lat <= bounds.n && s.project.lng >= bounds.w && s.project.lng <= bounds.e));
    return lead ? list.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0)) : list.sort((a, b) => (a.project?.name ?? '').localeCompare(b.project?.name ?? '') || a.unit.unitNumber.localeCompare(b.unit.unitNumber, undefined, { numeric: true }));
  }, [units, onlyAvailable, onlyVisible, bounds, lead, fields, projById]);
  // Λίστα δεξιά: ομαδοποίηση ανά έργο (κλειστά — ανοίγουν με κλικ).
  const groups = useMemo(() => {
    const m = new Map<string, Scored[]>();
    for (const x of scored) { const k = x.unit.projectId; m.set(k, [...(m.get(k) ?? []), x]); }
    return [...m.entries()];
  }, [scored]);

  /* ── day plan ── */
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Nicosia' }).format(new Date());
  const [day, setDay] = useState(today);
  const [agent, setAgent] = useState(me);
  const [stops, setStops] = useState<DayStop[] | null>(null);
  const [loadingDay, startDay] = useTransition();
  const loadDay = () => startDay(async () => {
    setErr(null);
    const r = await getDayPlan(agent, day);
    if (r.ok) setStops(r.stops); else { setStops([]); setErr(r.error); }
  });
  useEffect(() => { if (mode === 'day') loadDay(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode, day, agent]);

  /* ── the map ── */
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const meRef = useRef<any>(null);
  const ptsRef = useRef<[number, number][]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !box.current || mapRef.current) return;
      const m = L.map(box.current, { zoomControl: true }).setView([34.9, 33.2], 9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
      layerRef.current = L.layerGroup().addTo(m);
      const upd = () => { const b = m.getBounds(); setBounds({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }); };
      m.on('moveend', upd);
      mapRef.current = m;
      upd();
      setReady(true);
    }).catch((e) => setErr(e.message));
    return () => { cancelled = true; };
  }, []);

  // Markers: projects (match mode) or the day's stops (day mode).
  useEffect(() => {
    const L = (window as any).L;
    const m = mapRef.current;
    if (!ready || !L || !m) return;
    const layer = layerRef.current;
    layer.clearLayers();
    const pts: [number, number][] = [];

    if (mode === 'match') {
      const byProject = new Map<string, Scored[]>();
      for (const s of scored) if (s.project) byProject.set(s.project.id, [...(byProject.get(s.project.id) ?? []), s]);
      for (const p of projects) {
        const list = byProject.get(p.id) ?? [];
        if (!list.length && (lead || onlyAvailable)) continue;
        const best = lead ? list.reduce<MatchResult | null>((acc, s) => (!acc || (s.match?.score ?? 0) > acc.score ? s.match : acc), null) : null;
        const color = best ? TIER_COLOR[best.tier] : list.length ? '#1F3A30' : '#9A968E';
        const marker = L.circleMarker([p.lat, p.lng], { radius: 9 + Math.min(8, list.length), color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9, dashArray: p.approx ? '3 3' : undefined });
        const rows = list.slice(0, 6).map((s) => `<li><a href="/projects/${p.id}/units/${s.unit.id}" style="color:#1F3A30">Μονάδα ${esc(s.unit.unitNumber)}</a> · ${s.unit.price != null ? esc(formatCurrency(s.unit.price)) : '—'}${s.match ? ` · <b>${s.match.score}%</b>` : ''}</li>`).join('');
        marker.bindPopup(`<div style="min-width:190px"><b>${esc(p.name)}</b>${p.location ? `<br><span style="color:#777">${esc(p.location)}</span>` : ''}${p.approx ? '<br><i style="color:#a37b2c">Θέση κατά προσέγγιση</i>' : ''}<ul style="margin:6px 0 0;padding-left:16px">${rows || '<li>Καμία διαθέσιμη μονάδα</li>'}</ul>${list.length > 6 ? `<span style="color:#777">+${list.length - 6} ακόμη</span>` : ''}</div>`);
        marker.bindTooltip(`${p.name}${list.length ? ` · ${list.length}` : ''}${best ? ` · ${best.score}%` : ''}`);
        marker.addTo(layer);
        pts.push([p.lat, p.lng]);
      }
    } else if (stops) {
      const placed = stops.filter((s) => s.lat != null && s.lng != null);
      placed.forEach((s, i) => {
        const icon = L.divIcon({ className: '', html: `<div style="background:#1F3A30;color:#fff;border:2px solid #fff;border-radius:999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font:600 12px sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.3)">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
        L.marker([s.lat, s.lng], { icon }).bindPopup(`<b>${esc(formatTime(s.time))} · ${esc(s.contact)}</b><br>${esc([s.project, s.unit ? `Μονάδα ${s.unit}` : null].filter(Boolean).join(' · '))}`).addTo(layer);
        pts.push([s.lat!, s.lng!]);
      });
      if (pts.length > 1) L.polyline(pts, { color: '#C8A86B', weight: 3, dashArray: '6 6' }).addTo(layer);
    }
    ptsRef.current = pts;
  }, [ready, mode, scored, projects, stops, lead, onlyAvailable]);

  // Πρώτο άνοιγμα: ζουμ ώστε να φαίνονται όλα τα έργα (όχι όλη η Μεσόγειος).
  const fitted = useRef(false);
  useEffect(() => {
    const m = mapRef.current; const L = (window as any).L;
    if (!ready || !m || !L || fitted.current || mode !== 'match' || !projects.length) return;
    fitted.current = true;
    const pts = projects.map((p) => [p.lat, p.lng] as [number, number]);
    if (pts.length === 1) m.setView(pts[0], 13); else m.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  }, [ready, mode, projects]);

  // Zoom to the buyer's matches / the day's route — only when THOSE change (not on every pan).
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const t = setTimeout(() => { const pts = ptsRef.current; if (pts.length && (mode === 'day' || lead)) m.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); }, 0);
    return () => clearTimeout(t);
  }, [ready, mode, stops, lead?.leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const myLocation = () => {
    const L = (window as any).L;
    if (!navigator.geolocation || !mapRef.current || !L) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      if (meRef.current) meRef.current.remove();
      meRef.current = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Είστε εδώ').addTo(mapRef.current);
      mapRef.current.setView(ll, 13);
    }, () => setErr('Δεν δόθηκε άδεια για την τοποθεσία σας.'));
  };

  const togglePick = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /* ── send selection ── */
  const [sendOpen, setSendOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState<{ url: string; whatsapp: string | null; mailto: string | null } | null>(null);
  const [sending, startSend] = useTransition();
  const send = () => startSend(async () => {
    setErr(null);
    const r = await createSelection({ leadId: lead?.leadId ?? null, contactId: lead?.contactId ?? null, unitIds: Array.from(picked), message: msg });
    if (r.ok) setSent(r); else setErr(r.error);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-stone p-0.5 text-sm">
          <button type="button" onClick={() => setMode('match')} className={`flex items-center gap-1 rounded-full px-3 py-1 ${mode === 'match' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal-600'}`}><Users size={14} /> Μονάδες & αγοραστές</button>
          {canLeads && <button type="button" onClick={() => setMode('day')} className={`flex items-center gap-1 rounded-full px-3 py-1 ${mode === 'day' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal-600'}`}><Route size={14} /> Πλάνο ημέρας</button>}
        </div>
        <button type="button" onClick={myLocation} className="btn-secondary px-3 py-1.5 text-xs"><Crosshair size={13} /> Η θέση μου</button>
        {err && <span className="text-sm text-signal-danger">{err}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div ref={box} className="panel h-[60vh] min-h-[420px] overflow-hidden p-0 lg:h-[calc(100vh-220px)]" />

        <div className="space-y-3">
          {mode === 'match' ? (
            <>
              <div className="panel space-y-2 p-4">
                {canLeads && (
                  <label className="block">
                    <span className="eyebrow mb-1 block">Ταίριασμα αγοραστή</span>
                    <div className="flex gap-2">
                      <input className="input" list="map-leads" value={leadQ} onChange={(e) => { setLeadQ(e.target.value); setPicked(new Set()); setSent(null); }} placeholder="Γράψτε όνομα αγοραστή…" />
                      {leadQ && <button type="button" onClick={() => { setLeadQ(''); setPicked(new Set()); }} className="text-charcoal-600/60 hover:text-charcoal"><X size={16} /></button>}
                    </div>
                    <datalist id="map-leads">{leads.map((l) => <option key={l.leadId} value={leadLabel(l)} />)}</datalist>
                  </label>
                )}
                {lead && (
                  <p className="text-xs text-charcoal-600">
                    {lead.criteria.budgetMin || lead.criteria.budgetMax ? `${lead.criteria.budgetMin ? formatCurrency(lead.criteria.budgetMin) : '—'} – ${lead.criteria.budgetMax ? formatCurrency(lead.criteria.budgetMax) : '—'}` : 'Χωρίς προϋπολογισμό'}
                    {' · '}{lead.areas.length ? lead.areas.join(', ') : 'οπουδήποτε'}
                    {' · '}<Link href={`/crm/leads/${lead.leadId}`} className="text-forest hover:underline">κριτήρια</Link>
                  </p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-charcoal-600">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> Μόνο διαθέσιμες</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={onlyVisible} onChange={(e) => setOnlyVisible(e.target.checked)} /> Μόνο ό,τι φαίνεται στον χάρτη</label>
                </div>
              </div>

              {picked.size > 0 && canLeads && (
                <button type="button" onClick={() => { setSendOpen(true); setSent(null); }} className="btn-primary w-full justify-center"><Send size={15} /> Αποστολή επιλογής ({picked.size}){lead ? ` στον/στην ${lead.name.split(' ')[0]}` : ''}</button>
              )}

              <div className="panel max-h-[calc(100vh-380px)] min-h-[200px] divide-y divide-stone-line overflow-y-auto p-0">
                {scored.length === 0 && <p className="p-6 text-center text-sm text-charcoal-600/70">Καμία μονάδα με αυτά τα φίλτρα.</p>}
                {groups.map(([pid, list]) => {
                  const pr = list[0].project; const isOpen = openProj.has(pid) || (!!lead && list.some((x) => x.match));
                  const best = list.reduce((a, x) => Math.max(a, x.match?.score ?? 0), 0);
                  return (
                    <div key={pid}>
                      <div className="flex items-center gap-2 bg-stone/40 px-3 py-2.5">
                        <button type="button" onClick={() => toggleProj(pid)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                          <ChevronRight size={15} className={`shrink-0 text-charcoal-600/60 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-charcoal" data-no-tr>{pr?.name ?? 'Έργο'}</span>
                            <span className="block truncate text-[11px] text-charcoal-600/70">{list.length} μονάδες{pr?.location ? ` · ${pr.location}` : ''}</span>
                          </span>
                        </button>
                        {best > 0 && <span className="figure shrink-0 rounded bg-forest px-1.5 py-0.5 text-[11px] font-medium text-white">{best}%</span>}
                        <Link href={`/projects/${pid}`} className="shrink-0 rounded p-1 text-charcoal-600/60 hover:bg-stone hover:text-forest" title="Άνοιγμα έργου" aria-label="Άνοιγμα έργου"><ArrowUpRight size={15} /></Link>
                      </div>
                      {isOpen && list.map((s) => (
                  <div key={s.unit.id} className="flex items-start gap-2 py-2.5 pl-9 pr-3">
                    {canLeads && <input type="checkbox" className="mt-1" checked={picked.has(s.unit.id)} onChange={() => togglePick(s.unit.id)} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/projects/${s.unit.projectId}/units/${s.unit.id}`} className="truncate text-sm font-medium text-charcoal hover:text-forest">
                          {s.project?.name ?? 'Έργο'} · {s.unit.unitNumber}
                        </Link>
                        {s.match && <span className="figure shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ background: TIER_COLOR[s.match.tier] }}>{s.match.score}%</span>}
                      </div>
                      <p className="text-[11px] text-charcoal-600/80">
                        {s.unit.price != null ? formatCurrency(s.unit.price) : '—'}{s.unit.bedrooms != null ? ` · ${s.unit.bedrooms} υπν.` : ''}{s.unit.sqm != null ? ` · ${s.unit.sqm} m²` : ''}{s.unit.status !== 'available' ? ' · κρατημένη' : ''}
                        {!s.project && <span className="ml-1 inline-flex items-center gap-0.5 text-champagne-600"><MapPin size={10} /> χωρίς θέση</span>}
                      </p>
                      {s.match && s.match.total > 0 && (
                        <p className="text-[11px]">
                          <span className="text-charcoal-600">{s.match.met}/{s.match.total} κριτήρια</span>
                          {s.match.misses.length > 0 && <span className="text-signal-danger"> · Λείπει: {s.match.misses.join(', ')}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {unplaced.length > 0 && (
                <p className="text-[11px] text-charcoal-600/70">Δεν φαίνονται στον χάρτη (λείπει η θέση): {unplaced.map((p, i) => <span key={p.id}>{i ? ', ' : ''}<Link href={`/projects/${p.id}`} className="text-forest hover:underline">{p.name}</Link></span>)}. Ορίστε τη θέση από τη σελίδα μιας μονάδας του έργου → «Τοποθεσία».</p>
              )}
            </>
          ) : (
            <DayPanel stops={stops} loading={loadingDay} day={day} setDay={setDay} agent={agent} setAgent={setAgent} agents={agents} />
          )}
        </div>
      </div>

      {sendOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4" onClick={() => setSendOpen(false)}>
          <div className="panel w-full max-w-md space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h4>Αποστολή επιλογής</h4><button type="button" onClick={() => setSendOpen(false)}><X size={18} /></button></div>
            {!sent ? (
              <>
                <p className="text-sm text-charcoal-600">{picked.size} μονάδες{lead ? ` για ${lead.name}` : ''}. Ο πελάτης παίρνει σύνδεσμο που ανοίγει χωρίς κωδικό, βλέπει φωτογραφίες, τιμές και χαρακτηριστικά, και μπορεί να πατήσει «Θέλω προβολή».</p>
                <textarea className="input min-h-[80px]" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Προσωπικό μήνυμα (προαιρετικό)" />
                <button type="button" disabled={sending} onClick={send} className="btn-primary w-full justify-center">{sending ? 'Δημιουργία…' : 'Δημιουργία συνδέσμου'}</button>
              </>
            ) : (
              <>
                <div className="flex gap-2"><input readOnly value={sent.url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} /><button type="button" onClick={() => navigator.clipboard?.writeText(sent.url)} className="btn-secondary px-3" title="Αντιγραφή"><Copy size={14} /></button></div>
                <div className="grid grid-cols-2 gap-2">
                  {sent.whatsapp ? <a href={sent.whatsapp} target="_blank" rel="noreferrer" className="btn-primary justify-center"><MessageCircle size={15} /> WhatsApp</a> : <span className="btn-secondary justify-center opacity-50">Χωρίς τηλέφωνο</span>}
                  {sent.mailto ? <a href={sent.mailto} className="btn-secondary justify-center"><Mail size={15} /> Email</a> : <span className="btn-secondary justify-center opacity-50">Χωρίς email</span>}
                </div>
                <p className="text-[11px] text-charcoal-600/70">Καταγράφηκε στο ιστορικό του πελάτη. Θα ειδοποιηθείτε όταν ανοίξει τον σύνδεσμο ή ζητήσει προβολή.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DayPanel({ stops, loading, day, setDay, agent, setAgent, agents }: {
  stops: DayStop[] | null; loading: boolean; day: string; setDay: (d: string) => void; agent: string; setAgent: (a: string) => void; agents: { id: string; name: string }[];
}) {
  const url = stops ? directionsUrl(stops) : null;
  return (
    <>
      <div className="panel grid grid-cols-2 gap-2 p-4">
        <label className="block"><span className="eyebrow mb-1 block">Ημέρα</span><input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="block"><span className="eyebrow mb-1 block">Πωλητής</span>
          <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)}>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </label>
      </div>
      <div className="panel space-y-0 p-0">
        {loading && <p className="p-6 text-center text-sm text-charcoal-600/70">Φόρτωση…</p>}
        {!loading && stops && stops.length === 0 && <p className="p-6 text-center text-sm text-charcoal-600/70">Καμία προβολή αυτή τη μέρα.</p>}
        {!loading && stops && stops.map((s, i) => {
          const prev = i > 0 ? stops[i - 1] : null;
          const leg = prev && prev.lat != null && s.lat != null ? legBetween({ lat: prev.lat, lng: prev.lng! }, { lat: s.lat, lng: s.lng! }) : null;
          const gap = prev ? Math.round((Date.parse(s.time) - Date.parse(prev.time)) / 60000) - VIEWING_MIN : null;
          const tight = leg && gap != null && gap < leg.minutes;
          return (
            <div key={s.id}>
              {leg && (
                <p className={`flex items-center gap-1 border-t border-stone-line px-4 py-1 text-[11px] ${tight ? 'bg-signal-danger/10 text-signal-danger' : 'text-charcoal-600/70'}`}>
                  {tight && <AlertTriangle size={11} />} ~{leg.km} km · {leg.minutes}′ οδήγηση{gap != null ? ` · ${gap >= 0 ? `${gap}′ περιθώριο` : 'επικαλύπτονται'}` : ''}{tight ? ' — δεν προλαβαίνετε' : ''}
                </p>
              )}
              <div className="flex items-start gap-3 border-t border-stone-line px-4 py-2.5 first:border-t-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white">{i + 1}</span>
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-charcoal">{formatTime(s.time)} · {s.contact}</p>
                  <p className="text-[11px] text-charcoal-600">{[s.project, s.unit ? `Μονάδα ${s.unit}` : null].filter(Boolean).join(' · ') || '—'}{s.lat == null ? ' · χωρίς θέση' : s.approx ? ' · θέση κατά προσέγγιση' : ''}</p>
                  {s.phone && <a href={`tel:${s.phone}`} className="text-[11px] text-forest hover:underline">{s.phone}</a>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {url && <a href={url} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center"><Route size={15} /> Διαδρομή στο Google Maps</a>}
    </>
  );
}
