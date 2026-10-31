import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBuyerUnit } from '@/lib/buyer';
import { HardHat, CalendarCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { BuyerMilestoneTimeline } from '@/components/buyer/BuyerMilestoneTimeline';
import { BuyerUpdatesFeed } from '@/components/buyer/BuyerUpdatesFeed';
import { ProjectGallery } from '@/components/projects/ProjectGallery';
import { getDocumentUrl } from '@/app/actions/storage';
import { loadUpdates } from '@/lib/construction';
import { milestoneLabel } from '@/lib/construction-shared';
import { currentLocale, type Lang } from '@/lib/locale-shared';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const T: Record<string, Record<Lang, string>> = {
  title: { el: 'Πρόοδος κατασκευής', en: 'Construction progress', ru: 'Ход строительства' },
  unit: { el: 'Μονάδα', en: 'Unit', ru: 'Объект' },
  handover: { el: 'Εκτιμώμενη παράδοση', en: 'Estimated handover', ru: 'Ожидаемая сдача' },
  progress: { el: 'Πρόοδος της μονάδας σας', en: 'Your home’s progress', ru: 'Готовность вашего объекта' },
  stage: { el: 'Τελευταίο στάδιο', en: 'Latest stage', ru: 'Последний этап' },
  stages: { el: 'Στάδια κατασκευής', en: 'Build stages', ru: 'Этапы строительства' },
  updates: { el: 'Ενημερώσεις από το εργοτάξιο', en: 'Updates from the site', ru: 'Новости со стройплощадки' },
  none: { el: 'Οι πρώτες ενημερώσεις με φωτογραφίες θα εμφανιστούν εδώ μόλις τις δημοσιεύσει η ομάδα του έργου.', en: 'The first updates with photos will appear here as soon as the project team publishes them.', ru: 'Первые новости с фотографиями появятся здесь, как только их опубликует команда проекта.' },
  photos: { el: 'Φωτογραφίες έργου', en: 'Project photos', ru: 'Фотографии проекта' },
  soonTitle: { el: 'Οι ενημερώσεις κατασκευής έρχονται σύντομα', en: 'Construction updates coming soon', ru: 'Скоро здесь появятся новости строительства' },
  soonBody: { el: 'Μόλις συνδεθεί η μονάδα σας, θα βλέπετε εδώ κάθε στάδιο της κατασκευής.', en: 'Once your unit is linked, you’ll follow every stage of construction here.', ru: 'Как только ваш объект будет привязан, вы увидите здесь каждый этап строительства.' },
};

export default async function ConstructionProgressPage() {
  const profile = await requireRole(['buyer', 'admin', 'sales', 'management']);
  const lang = currentLocale().lang;
  const unit = await getBuyerUnit(profile.contactId);

  if (!unit) return <EmptyState icon={HardHat} title={T.soonTitle[lang]} description={T.soonBody[lang]} />;

  const supabase = await createSupabaseServerClient();
  const [{ data: milestones }, { data: photos }, { data: extra }] = await Promise.all([
    supabase.from('project_milestones').select('id, milestone_type, status, planned_end, actual_end').eq('project_id', unit.project_id),
    supabase.from('documents').select('id, storage_path, title, bucket').eq('entity_type', 'project').eq('entity_id', unit.project_id).eq('bucket', 'project-media').order('created_at', { ascending: false }),
    supabase.from('units').select('construction_progress, building_id').eq('id', unit.id).maybeSingle(),
  ]);
  const updates = await loadUpdates({ projectId: unit.project_id, unitId: unit.id, buildingId: (extra as any)?.building_id ?? null, limit: 40 });

  const deliveryMilestone = (milestones ?? []).find((m) => m.milestone_type === 'delivery');
  const estimatedHandover = unit.handover_date ?? deliveryMilestone?.planned_end ?? null;
  const progress = Math.max(0, Math.min(100, Number((extra as any)?.construction_progress ?? 0)));
  const latestStage = updates.items.find((u) => u.milestoneType)?.milestoneType ?? null;
  const galleryItems = (photos ?? []).map((p) => ({ id: p.id, storage_path: p.storage_path, title: p.title }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">{unit.project_name} · {T.unit[lang]} {unit.unit_number}</p>
          <h1 className="font-display text-3xl">{T.title[lang]}</h1>
        </div>
        {estimatedHandover && (
          <div className="flex items-center gap-2 rounded-md bg-forest px-4 py-2.5 text-stone-100">
            <CalendarCheck size={16} className="text-champagne" strokeWidth={1.75} />
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-eyebrow text-stone-100/60">{T.handover[lang]}</p>
              <p className="figure text-sm">{formatDate(estimatedHandover)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="panel p-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h4>{T.progress[lang]}</h4>
          <span className="figure text-3xl text-forest">{progress}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-stone">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${progress}%` }} />
        </div>
        {latestStage && <p className="mt-2 text-xs text-charcoal-600/70">{T.stage[lang]}: {milestoneLabel(latestStage, lang)}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-1">
          <h4 className="mb-5">{T.stages[lang]}</h4>
          <BuyerMilestoneTimeline milestones={milestones ?? []} />
        </div>
        <div className="panel p-6 lg:col-span-2">
          <h4 className="mb-4">{T.updates[lang]}</h4>
          {updates.items.length ? <BuyerUpdatesFeed items={updates.items} lang={lang} buildingName={unit.building_name} /> : <p className="text-sm text-charcoal-600/70">{T.none[lang]}</p>}
        </div>
      </div>

      {galleryItems.length > 0 && (
        <div className="panel p-6">
          <h4 className="mb-4">{T.photos[lang]}</h4>
          <ProjectGallery items={galleryItems} getUrl={getDocumentUrl.bind(null, 'project-media')} />
        </div>
      )}
    </div>
  );
}
