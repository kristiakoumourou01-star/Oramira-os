import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { loadDuplicatePairs } from '@/lib/duplicates';
import { DuplicatePairs } from '@/components/crm/DuplicatePairs';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

export const dynamic = 'force-dynamic';

/** CRM → Διπλές επαφές: ίδιο email, τηλέφωνο (8 τελευταία ψηφία) ή ονοματεπώνυμο. */
export default async function DuplicatesPage() {
  const profile = await requirePermission('leads');
  const { pairs, missing } = await loadDuplicatePairs();
  const canMerge = ['admin', 'management', 'sales'].includes(profile.role);
  return (
    <div className="space-y-5">
      <Link href="/crm/leads" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest"><ArrowLeft size={14} /> Leads</Link>
      <WorkspaceHeader eyebrow="CRM" title="Διπλές επαφές" description="Ο ίδιος άνθρωπος καταχωρημένος δύο φορές. Διαλέξτε ποια επαφή μένει — τα υπόλοιπα μεταφέρονται σε αυτή." />
      {missing
        ? <p className="panel p-5 text-sm text-signal-danger">Λείπει το migration 0069 στη βάση.</p>
        : <DuplicatePairs pairs={pairs} canMerge={canMerge} />}
    </div>
  );
}
