'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building, Layers } from 'lucide-react';
import { addBuilding, addPhase } from '@/app/actions/projects';

export interface BuildingNode {
  id: string;
  name: string;
  floors: number | null;
  unitCount: number;
}
export interface PhaseNode {
  id: string;
  name: string;
  building_id: string | null;
  sequence: number;
}

/**
 * Buildings & phases editor. A project has many buildings; each phase may be
 * scoped to a building or left at project level. Kept as a single calm panel
 * rather than nested modals — structure is edited rarely and read often.
 */
export function StructureManager({
  projectId,
  buildings,
  phases,
}: {
  projectId: string;
  buildings: BuildingNode[];
  phases: PhaseNode[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [showBuilding, setShowBuilding] = useState(false);
  const [showPhase, setShowPhase] = useState(false);

  function submitBuilding(formData: FormData) {
    startTransition(async () => {
      await addBuilding({
        projectId,
        name: String(formData.get('name')),
        floors: Number(formData.get('floors')) || undefined,
      });
      setShowBuilding(false);
      router.refresh();
    });
  }

  function submitPhase(formData: FormData) {
    startTransition(async () => {
      await addPhase({
        projectId,
        name: String(formData.get('name')),
        buildingId: String(formData.get('buildingId') || '') || undefined,
        sequence: Number(formData.get('sequence')) || undefined,
      });
      setShowPhase(false);
      router.refresh();
    });
  }

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4>Structure</h4>
        <div className="flex gap-2">
          <button onClick={() => setShowBuilding((v) => !v)} className="btn-ghost text-xs">
            <Plus size={13} strokeWidth={1.75} /> Building
          </button>
          <button onClick={() => setShowPhase((v) => !v)} className="btn-ghost text-xs">
            <Plus size={13} strokeWidth={1.75} /> Phase
          </button>
        </div>
      </div>

      {showBuilding && (
        <form action={submitBuilding} className="mb-4 grid grid-cols-[1fr_120px_auto] gap-2">
          <input name="name" required placeholder="Building name (e.g. Block A)" className="input" />
          <input name="floors" type="number" placeholder="Floors" className="input" />
          <button type="submit" disabled={isPending} className="btn-primary">Add</button>
        </form>
      )}

      {showPhase && (
        <form action={submitPhase} className="mb-4 grid grid-cols-[1fr_1fr_90px_auto] gap-2">
          <input name="name" required placeholder="Phase name (e.g. Phase 1)" className="input" />
          <select name="buildingId" className="input">
            <option value="">Whole project</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input name="sequence" type="number" placeholder="Seq" className="input" />
          <button type="submit" disabled={isPending} className="btn-primary">Add</button>
        </form>
      )}

      {buildings.length === 0 && phases.length === 0 ? (
        <p className="text-sm text-charcoal-600/70">No buildings or phases yet — add a building to start laying out the project.</p>
      ) : (
        <div className="space-y-3">
          {buildings.map((b) => (
            <div key={b.id} className="rounded border border-stone-line p-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-medium text-charcoal">
                  <Building size={14} className="text-olive" strokeWidth={1.75} /> {b.name}
                  {b.floors != null && <span className="text-xs text-charcoal-600/60">· {b.floors} floors</span>}
                </p>
                <span className="figure text-xs text-charcoal-600/70">{b.unitCount} units</span>
              </div>
              {phases.filter((p) => p.building_id === b.id).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {phases
                    .filter((p) => p.building_id === b.id)
                    .sort((a, c) => a.sequence - c.sequence)
                    .map((p) => (
                      <span key={p.id} className="badge-neutral">
                        <Layers size={11} strokeWidth={1.75} className="mr-1" /> {p.name}
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))}

          {phases.filter((p) => !p.building_id).length > 0 && (
            <div className="rounded border border-dashed border-stone-line p-3">
              <p className="eyebrow mb-2">Project-level phases</p>
              <div className="flex flex-wrap gap-1.5">
                {phases
                  .filter((p) => !p.building_id)
                  .sort((a, c) => a.sequence - c.sequence)
                  .map((p) => (
                    <span key={p.id} className="badge-neutral">
                      <Layers size={11} strokeWidth={1.75} className="mr-1" /> {p.name}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
