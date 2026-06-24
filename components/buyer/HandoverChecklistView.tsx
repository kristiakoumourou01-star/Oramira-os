import { Check, Circle } from 'lucide-react';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string | null;
  is_complete: boolean;
  completed_at: string | null;
}

/**
 * Read-only handover checklist for the buyer. Staff tick items off on their
 * side; the buyer sees a calm, trustworthy record of what's done and what's
 * still ahead before keys change hands.
 */
export function HandoverChecklistView({ items }: { items: ChecklistItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-charcoal-600/70">Your handover checklist will appear here as your unit nears completion.</p>;
  }

  const done = items.filter((i) => i.is_complete).length;

  return (
    <div>
      <p className="mb-4 text-sm text-charcoal-600/70">
        <span className="figure text-charcoal">{done}</span> of <span className="figure">{items.length}</span> steps complete
      </p>
      <ul className="divide-y divide-stone-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-3">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.is_complete ? 'bg-forest text-stone-100' : 'text-stone-line'}`}>
              {item.is_complete ? <Check size={12} strokeWidth={2.5} /> : <Circle size={16} strokeWidth={1.75} />}
            </span>
            <div>
              <p className={`text-sm ${item.is_complete ? 'text-charcoal' : 'text-charcoal-600'}`}>{item.label}</p>
              {item.description && <p className="mt-0.5 text-xs text-charcoal-600/60">{item.description}</p>}
              {item.is_complete && item.completed_at && (
                <p className="mt-0.5 text-xs text-signal-success">Completed {new Date(item.completed_at).toLocaleDateString()}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
