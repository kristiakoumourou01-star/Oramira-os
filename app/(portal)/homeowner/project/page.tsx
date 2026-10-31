import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHomeownerUnit } from '@/lib/homeowner';
import { loadDevelopmentMapData } from '@/lib/development-map-data';
import { loadSignedProjectMedia } from '@/lib/project-media';
import { SiteMap } from '@/components/property/SiteMap';
import { DevelopmentMap } from '@/components/property/DevelopmentMap';
import { Building2, CalendarCheck, Phone, Mail, HardHat, ShieldAlert, Trees, Map as MapIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/format';

export default async function HomeownerProjectPage() {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const unit = await getHomeownerUnit(profile.contactId);

  if (!unit) {
    return <EmptyState icon={Building2} title="Your project" description="Your development's details will appear here once your unit is linked." />;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: project }, { data: team }, { data: assignments }, mapData, media] = await Promise.all([
    supabase.from('projects').select('name, location, delivery_date, common_areas, maintenance_schedule, management_contact, emergency_contact').eq('id', unit.project_id).maybeSingle(),
    supabase.from('project_team_contacts').select('id, role, name, email, phone').eq('project_id', unit.project_id),
    supabase.from('contractor_project_assignments').select('id, trade, contractors(company_name, phone, email)').eq('project_id', unit.project_id),
    // Whole development (service role; the owner is verified above), other owners redacted.
    loadDevelopmentMapData(unit.project_id, { serviceRole: true, redactOwners: true }),
    loadSignedProjectMedia(unit.project_id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
        <h1 className="font-display text-3xl">My Property</h1>
      </div>

      {mapData.houses.length > 0 && (
        <div className="panel p-6">
          <h4 className="mb-4 flex items-center gap-2"><MapIcon size={15} className="text-olive" strokeWidth={1.75} /> Development map — your home is highlighted</h4>
          {mapData.developmentType === 'apartments' ? (
            <DevelopmentMap blocks={mapData.blocks} media={media} unitDetails={mapData.unitDetails} ownerUnitId={unit.id} />
          ) : (
            <SiteMap houses={mapData.houses} media={media} unitDetails={mapData.unitDetails} ownerUnitId={unit.id} />
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="panel p-6">
            <h4 className="mb-4">{project?.name ?? unit.project_name}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="eyebrow">Location</p><p className="text-charcoal">{project?.location ?? '—'}</p></div>
              <div><p className="eyebrow flex items-center gap-1"><CalendarCheck size={11} strokeWidth={1.75} /> Delivery date</p><p className="figure text-charcoal">{project?.delivery_date ? formatDate(project.delivery_date) : '—'}</p></div>
            </div>
            {project?.common_areas && (
              <div className="mt-4"><p className="eyebrow flex items-center gap-1"><Trees size={11} strokeWidth={1.75} /> Common areas</p><p className="mt-1 text-sm leading-relaxed text-charcoal-600/85">{project.common_areas}</p></div>
            )}
            {project?.maintenance_schedule && (
              <div className="mt-4"><p className="eyebrow">Maintenance schedule</p><p className="mt-1 text-sm leading-relaxed text-charcoal-600/85">{project.maintenance_schedule}</p></div>
            )}
          </div>

          <div className="panel p-6">
            <h4 className="mb-4 flex items-center gap-2"><HardHat size={15} className="text-olive" strokeWidth={1.75} /> Contractor & team contacts</h4>
            {(team ?? []).length === 0 && (assignments ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No contacts published yet.</p>
            ) : (
              <ul className="divide-y divide-stone-line">
                {(team ?? []).map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between py-2.5">
                    <div><p className="text-sm font-medium text-charcoal">{c.name}</p><p className="text-xs capitalize text-charcoal-600/60">{c.role?.replace(/_/g, ' ')}</p></div>
                    <div className="flex gap-3 text-xs">
                      {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-charcoal-600 hover:text-forest"><Phone size={12} strokeWidth={1.75} /> {c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-charcoal-600 hover:text-forest"><Mail size={12} strokeWidth={1.75} /> Email</a>}
                    </div>
                  </li>
                ))}
                {(assignments ?? []).map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <div><p className="text-sm font-medium text-charcoal">{a.contractors?.company_name ?? 'Contractor'}</p><p className="text-xs capitalize text-charcoal-600/60">{a.trade ?? 'contractor'}</p></div>
                    <div className="flex gap-3 text-xs">
                      {a.contractors?.phone && <a href={`tel:${a.contractors.phone}`} className="flex items-center gap-1 text-charcoal-600 hover:text-forest"><Phone size={12} strokeWidth={1.75} /> {a.contractors.phone}</a>}
                      {a.contractors?.email && <a href={`mailto:${a.contractors.email}`} className="flex items-center gap-1 text-charcoal-600 hover:text-forest"><Mail size={12} strokeWidth={1.75} /> Email</a>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6">
            <h4 className="mb-3 flex items-center gap-2"><ShieldAlert size={15} className="text-signal-warning" strokeWidth={1.75} /> Key contacts</h4>
            <div className="space-y-3 text-sm">
              <div><p className="eyebrow">Management</p><p className="text-charcoal">{project?.management_contact ?? '—'}</p></div>
              <div><p className="eyebrow">Emergency</p><p className="text-charcoal">{project?.emergency_contact ?? '—'}</p></div>
            </div>
          </div>
          <div className="panel p-6 text-sm text-charcoal-600/80">
            Need something fixed? Raise it in <span className="font-medium text-forest">Maintenance</span> and we&apos;ll assign a contractor.
          </div>
        </div>
      </div>
    </div>
  );
}
