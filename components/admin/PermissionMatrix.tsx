'use client';

import {
  ALL_ACTIONS, ACTION_LABEL, CONFIGURABLE_MODULES, MODULE_LABEL,
  type Action, type Module, type UserPermissions,
} from '@/lib/permissions';

/**
 * Module × action grid of checkboxes. Ticking any action also ticks "view";
 * unticking "view" clears the whole row (no hidden module with edit rights).
 */
export function PermissionMatrix({
  value,
  onChange,
  disabled = false,
}: {
  value: UserPermissions;
  onChange: (next: UserPermissions) => void;
  disabled?: boolean;
}) {
  const has = (m: Module, a: Action) => value[m]?.includes(a) ?? false;

  function toggle(m: Module, a: Action) {
    const current = new Set(value[m] ?? []);
    if (current.has(a)) {
      if (a === 'view') current.clear();
      else current.delete(a);
    } else {
      current.add(a);
      current.add('view');
    }
    const next: UserPermissions = { ...value };
    const ordered = ALL_ACTIONS.filter((x) => current.has(x));
    if (ordered.length) next[m] = ordered;
    else delete next[m];
    onChange(next);
  }

  function setRow(m: Module, on: boolean) {
    const next: UserPermissions = { ...value };
    if (on) next[m] = [...ALL_ACTIONS];
    else delete next[m];
    onChange(next);
  }

  return (
    <div className="overflow-x-auto rounded-md border border-stone-line">
      <table className="table-base w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Ενότητα</th>
            {ALL_ACTIONS.map((a) => <th key={a} className="text-center">{ACTION_LABEL[a]}</th>)}
            <th className="text-center">Όλα</th>
          </tr>
        </thead>
        <tbody>
          {CONFIGURABLE_MODULES.map((m) => {
            const all = ALL_ACTIONS.every((a) => has(m, a));
            return (
              <tr key={m}>
                <td className="font-medium text-charcoal">{MODULE_LABEL[m]}</td>
                {ALL_ACTIONS.map((a) => (
                  <td key={a} className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`${MODULE_LABEL[m]}: ${ACTION_LABEL[a]}`}
                      checked={has(m, a)}
                      disabled={disabled}
                      onChange={() => toggle(m, a)}
                    />
                  </td>
                ))}
                <td className="text-center">
                  <input
                    type="checkbox"
                    aria-label={`${MODULE_LABEL[m]}: όλα`}
                    checked={all}
                    disabled={disabled}
                    onChange={() => setRow(m, !all)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-charcoal-600/60">
        Οι χρήστες και οι ρυθμίσεις μένουν πάντα μόνο για τον admin.
      </p>
    </div>
  );
}
