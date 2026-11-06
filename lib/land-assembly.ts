/**
 * Land assembly logic — detects assembly opportunities from the parcel book:
 * clusters of parcels sharing an `area_ref` (adjacent owners), flags fragmented
 * holdings (several small plots that are worth more combined), and summarises
 * how much of each cluster is already secured. Pure aggregation.
 */

export interface AssemblyParcel {
  id: string;
  reference: string;
  areaRef: string | null;
  plotSizeSqm: number | null;
  stage: string;
  ownerName: string | null;
  score: number;
  marginAbs: number;             // modelled planning-uplift margin (€)
}

export interface AssemblyCluster {
  areaRef: string;
  parcels: AssemblyParcel[];
  ownerCount: number;
  totalArea: number;
  securedCount: number;          // parcels at acquired / due_diligence / offer_made
  missingCount: number;          // owners not yet secured (needed to complete)
  fragmented: boolean;           // several small plots → assembly upside
  strategic: boolean;            // large multi-owner block worth prioritising
  progressPct: number;           // secured / owners
  avgScore: number;
  estimatedUplift: number;       // combined margin + assembly premium once complete
}

const SECURED = ['offer_made', 'due_diligence', 'acquired'];
const FRAGMENT_AVG_SQM = 2000; // below this average, a multi-owner cluster is "fragmented"
const ASSEMBLY_PREMIUM = 0.15;  // combined developable land is worth ~15% more than the sum

/** Group parcels into assembly clusters (2+ owners sharing an area_ref). */
export function detectAssembly(parcels: AssemblyParcel[]): AssemblyCluster[] {
  const byArea = new Map<string, AssemblyParcel[]>();
  for (const p of parcels) {
    if (!p.areaRef) continue;
    const arr = byArea.get(p.areaRef) ?? [];
    arr.push(p);
    byArea.set(p.areaRef, arr);
  }

  const clusters: AssemblyCluster[] = [];
  for (const [areaRef, ps] of byArea) {
    if (ps.length < 2) continue; // an assembly needs more than one owner
    const totalArea = ps.reduce((s, p) => s + Number(p.plotSizeSqm ?? 0), 0);
    const securedCount = ps.filter((p) => SECURED.includes(p.stage)).length;
    const avgArea = totalArea / ps.length;
    const avgScore = Math.round(ps.reduce((s, p) => s + p.score, 0) / ps.length);
    const combinedMargin = ps.reduce((s, p) => s + p.marginAbs, 0);
    clusters.push({
      areaRef,
      parcels: ps.sort((a, b) => b.score - a.score),
      ownerCount: ps.length,
      totalArea,
      securedCount,
      missingCount: ps.length - securedCount,
      fragmented: avgArea > 0 && avgArea < FRAGMENT_AVG_SQM,
      strategic: ps.length >= 4 || totalArea >= 10000,
      progressPct: ps.length ? Math.round((securedCount / ps.length) * 100) : 0,
      avgScore,
      estimatedUplift: Math.round(combinedMargin * (1 + ASSEMBLY_PREMIUM)),
    });
  }

  // Biggest, least-secured opportunities first.
  return clusters.sort((a, b) => b.ownerCount - a.ownerCount || a.progressPct - b.progressPct);
}
