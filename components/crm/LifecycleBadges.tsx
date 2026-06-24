/**
 * Visualizes the full Lead -> Buyer -> Investor -> Homeowner lifecycle for
 * one contact. A contact can hold multiple badges at once (e.g. a buyer who
 * is also an investor) — this is the visual proof that "single identity"
 * is real, not just a database detail.
 */
export function LifecycleBadges({
  isLead, isBuyer, isInvestor, isHomeowner, isNewsletter = false,
}: { isLead: boolean; isBuyer: boolean; isInvestor: boolean; isHomeowner: boolean; isNewsletter?: boolean }) {
  const stages = [
    { active: isLead, label: 'Lead' },
    { active: isBuyer, label: 'Buyer' },
    { active: isInvestor, label: 'Investor' },
    { active: isHomeowner, label: 'Homeowner' },
    ...(isNewsletter ? [{ active: true, label: 'Subscriber' }] : []),
  ];

  return (
    <div className="flex gap-1.5">
      {stages.map((s) => (
        <span key={s.label} className={s.active ? 'badge-forest' : 'badge-neutral opacity-50'}>
          {s.label}
        </span>
      ))}
    </div>
  );
}
