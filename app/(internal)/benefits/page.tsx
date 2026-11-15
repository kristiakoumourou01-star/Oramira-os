import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { BenefitsHub, type Benefit } from '@/components/marketing/BenefitsHub';

export const dynamic = 'force-dynamic';

/** Benefits (όπως στο FitnessCRM): εκπτώσεις και παροχές συνεργατών για αγοραστές και ιδιοκτήτες. */
export default async function BenefitsPage() {
  const profile = await requirePermission('marketing');
  const db = (await createSupabaseServerClient()) as any;
  const { data } = await db.from('partner_benefits').select('*').order('created_at', { ascending: false });
  const rows: Benefit[] = ((data ?? []) as any[]).map((b) => ({ id: b.id, partner: b.partner, title: b.title, description: b.description, discount: b.discount, category: b.category, code: b.code, link: b.link, audience: b.audience ?? [], active: !!b.active, validUntil: b.valid_until, views: b.views ?? 0, taps: b.taps ?? 0 }));
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'marketing', 'edit', profile.permissions);
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Marketing" title="Benefits" description="Εκπτώσεις και παροχές συνεργατών (έπιπλα, τράπεζες, δικηγόροι, μετακόμιση…) για τους αγοραστές και ιδιοκτήτες σας — εμφανίζονται στην εφαρμογή τους." />
      <BenefitsHub rows={rows} canEdit={canEdit} />
    </div>
  );
}
