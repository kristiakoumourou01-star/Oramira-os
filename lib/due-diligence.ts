/**
 * Due-diligence checklist for a parcel. Stored as a jsonb map on land_parcels
 * (`{ ownership_verified: true, ... }`). Mandatory checks gate the move to
 * "Acquired" — enforced in updateParcelStage. Pure + deterministic.
 */

export interface DDCheck { key: string; label: string; mandatory: boolean }

export const DD_CHECKS: DDCheck[] = [
  { key: 'ownership_verified', label: 'Ownership verified', mandatory: true },
  { key: 'title_search', label: 'Title search', mandatory: true },
  { key: 'planning_search', label: 'Planning search', mandatory: true },
  { key: 'access_verified', label: 'Access verified', mandatory: false },
  { key: 'utilities_confirmed', label: 'Utilities confirmed', mandatory: false },
  { key: 'easements_checked', label: 'Easements checked', mandatory: false },
  { key: 'zoning_reviewed', label: 'Zoning reviewed', mandatory: false },
  { key: 'environmental_review', label: 'Environmental review', mandatory: false },
  { key: 'independent_valuation', label: 'Independent valuation', mandatory: true },
  { key: 'survey_uploaded', label: 'Survey uploaded', mandatory: false },
];

export interface DDSummary {
  items: { key: string; label: string; mandatory: boolean; done: boolean }[];
  completed: number;
  total: number;
  pct: number;
  mandatoryTotal: number;
  mandatoryDone: number;
  mandatoryComplete: boolean;
}

export function summarizeDD(dd: Record<string, unknown> | null | undefined): DDSummary {
  const map = (dd ?? {}) as Record<string, boolean>;
  const items = DD_CHECKS.map((c) => ({ ...c, done: !!map[c.key] }));
  const completed = items.filter((i) => i.done).length;
  const mandatory = items.filter((i) => i.mandatory);
  const mandatoryDone = mandatory.filter((i) => i.done).length;
  return {
    items,
    completed,
    total: items.length,
    pct: Math.round((completed / items.length) * 100),
    mandatoryTotal: mandatory.length,
    mandatoryDone,
    mandatoryComplete: mandatoryDone === mandatory.length,
  };
}
