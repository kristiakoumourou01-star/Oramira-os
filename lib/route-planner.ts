import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Viewing route planner. Cyprus has no in-app geodata, so travel time is
 * estimated from a town-to-town driving matrix keyed off each project's
 * `location` text. Given an agent's viewings for a day it: sequences them,
 * estimates travel between consecutive stops, flags gaps too tight to make,
 * proposes a location-clustered order that cuts total driving, and surfaces
 * bookable windows. Deterministic — safe to render server-side.
 */

type Client = SupabaseClient<Database>;

// Canonical Cyprus areas + approximate driving minutes between them (symmetric).
const AREAS = ['limassol', 'paphos', 'larnaca', 'nicosia', 'famagusta'] as const;
type Area = typeof AREAS[number];
const MATRIX: Record<Area, Record<Area, number>> = {
  limassol: { limassol: 0, paphos: 55, larnaca: 45, nicosia: 60, famagusta: 80 },
  paphos: { paphos: 0, limassol: 55, larnaca: 95, nicosia: 100, famagusta: 130 },
  larnaca: { larnaca: 0, limassol: 45, paphos: 95, nicosia: 45, famagusta: 40 },
  nicosia: { nicosia: 0, limassol: 60, paphos: 100, larnaca: 45, famagusta: 70 },
  famagusta: { famagusta: 0, limassol: 80, paphos: 130, larnaca: 40, nicosia: 70 },
};
const AREA_ALIASES: Record<string, Area> = {
  limassol: 'limassol', lemesos: 'limassol', paphos: 'paphos', pafos: 'paphos', larnaca: 'larnaca', larnaka: 'larnaca',
  nicosia: 'nicosia', lefkosia: 'nicosia', famagusta: 'famagusta', 'ayia napa': 'famagusta', 'agia napa': 'famagusta',
  protaras: 'famagusta', paralimni: 'famagusta',
};
const SAME_SITE_MIN = 5;   // hop within the same development
const SAME_AREA_MIN = 15;  // different site, same town
const DEFAULT_CROSS_MIN = 40; // unknown location, assume a cross-town drive

function canonicalArea(location: string | null): Area | null {
  if (!location) return null;
  const l = location.toLowerCase();
  for (const [alias, area] of Object.entries(AREA_ALIASES)) if (l.includes(alias)) return area;
  return null;
}

/** Estimated driving minutes between two stops. */
function travelMinutes(a: RouteStop, b: RouteStop): number {
  if (a.projectId && a.projectId === b.projectId) return SAME_SITE_MIN;
  const areaA = canonicalArea(a.location), areaB = canonicalArea(b.location);
  if (areaA && areaB) return areaA === areaB ? SAME_AREA_MIN : MATRIX[areaA][areaB];
  if ((a.location ?? '') && a.location === b.location) return SAME_AREA_MIN;
  return DEFAULT_CROSS_MIN;
}

export interface RouteStop {
  id: string; time: string; durationMin: number; contact: string; project: string | null; location: string | null;
  projectId: string | null; unit: string | null; leadId: string | null;
}
export interface RouteLeg { fromId: string; toId: string; travelMin: number; gapMin: number; slackMin: number; status: 'ok' | 'tight' | 'conflict' }
export interface RouteWindow { start: string; end: string; minutes: number }
export interface RoutePlan {
  stops: RouteStop[];              // in scheduled (time) order
  legs: RouteLeg[];                // between consecutive scheduled stops
  totalTravelMin: number;
  optimizedOrder: RouteStop[];     // location-clustered visiting order
  optimizedTravelMin: number;
  savedMin: number;
  windows: RouteWindow[];          // bookable gaps in the working day
  warnings: number;                // legs that are tight or conflicting
}

const DAY_START_HOUR = 9;
const DAY_END_HOUR = 18;
const MIN_WINDOW = 75; // minutes worth surfacing as bookable

function totalTravel(order: RouteStop[]): number {
  let t = 0;
  for (let i = 1; i < order.length; i++) t += travelMinutes(order[i - 1], order[i]);
  return t;
}

/** Greedy nearest-neighbour clustering from the first scheduled stop. */
function optimize(stops: RouteStop[]): RouteStop[] {
  if (stops.length <= 2) return stops.slice();
  const remaining = stops.slice(1);
  const order = [stops[0]];
  while (remaining.length) {
    const last = order[order.length - 1];
    let bestIdx = 0, bestT = Infinity;
    remaining.forEach((s, i) => { const t = travelMinutes(last, s); if (t < bestT) { bestT = t; bestIdx = i; } });
    order.push(remaining.splice(bestIdx, 1)[0]);
  }
  return order;
}

export async function buildRoutePlan(supabase: Client, agentId: string, day: Date = new Date()): Promise<RoutePlan> {
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(day); end.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from('viewings')
    .select('id, scheduled_at, status, lead_id, contacts(full_name), units(unit_number), projects(id, name, location)')
    .eq('agent_id', agentId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', start.toISOString())
    .lte('scheduled_at', end.toISOString())
    .order('scheduled_at', { ascending: true });

  const stops: RouteStop[] = (data ?? []).map((v: any) => ({
    id: v.id, time: v.scheduled_at, durationMin: 60, contact: v.contacts?.full_name ?? 'Lead',
    project: v.projects?.name ?? null, location: v.projects?.location ?? null, projectId: v.projects?.id ?? null,
    unit: v.units?.unit_number ?? null, leadId: v.lead_id,
  }));

  const legs: RouteLeg[] = [];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1], cur = stops[i];
    const travelMin = travelMinutes(prev, cur);
    const gapMin = Math.round((new Date(cur.time).getTime() - (new Date(prev.time).getTime() + prev.durationMin * 60000)) / 60000);
    const slackMin = gapMin - travelMin;
    legs.push({ fromId: prev.id, toId: cur.id, travelMin, gapMin, slackMin, status: slackMin < 0 ? 'conflict' : slackMin < 15 ? 'tight' : 'ok' });
  }

  const optimizedOrder = optimize(stops);
  const totalTravelMin = totalTravel(stops);
  const optimizedTravelMin = totalTravel(optimizedOrder);

  // Bookable windows inside the working day (before first / between / after last).
  const windows: RouteWindow[] = [];
  const dayOpen = new Date(day); dayOpen.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayClose = new Date(day); dayClose.setHours(DAY_END_HOUR, 0, 0, 0);
  const pushWindow = (s: Date, e: Date) => { const m = Math.round((e.getTime() - s.getTime()) / 60000); if (m >= MIN_WINDOW) windows.push({ start: s.toISOString(), end: e.toISOString(), minutes: m }); };
  if (stops.length === 0) { pushWindow(dayOpen, dayClose); }
  else {
    pushWindow(dayOpen, new Date(stops[0].time));
    for (let i = 1; i < stops.length; i++) pushWindow(new Date(new Date(stops[i - 1].time).getTime() + stops[i - 1].durationMin * 60000), new Date(stops[i].time));
    const lastEnd = new Date(new Date(stops[stops.length - 1].time).getTime() + stops[stops.length - 1].durationMin * 60000);
    pushWindow(lastEnd, dayClose);
  }

  return {
    stops, legs, totalTravelMin, optimizedOrder, optimizedTravelMin,
    savedMin: Math.max(0, totalTravelMin - optimizedTravelMin),
    windows, warnings: legs.filter((l) => l.status !== 'ok').length,
  };
}
