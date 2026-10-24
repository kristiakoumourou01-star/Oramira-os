import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, MapPin, Phone, Mail } from 'lucide-react';
import { TicketStatusBadge, PriorityBadge } from '@/components/homeowner/TicketStatusBadge';
import { JobStatusControl } from '@/components/contractor/JobStatusControl';
import { ScheduleVisitForm, type VisitItem } from '@/components/contractor/ScheduleVisitForm';
import { MaterialRequestPanel, type MaterialRequestRow } from '@/components/contractor/MaterialRequestPanel';
import { InternalNotes, type JobNote } from '@/components/contractor/InternalNotes';
import { CompletionPhotoUpload } from '@/components/contractor/CompletionPhotoUpload';
import { InvoiceUploadForm } from '@/components/contractor/InvoiceUploadForm';
import { MessageThread, type MessageItem } from '@/components/portal/MessageThread';
import { ProjectGallery } from '@/components/projects/ProjectGallery';
import { getDocumentUrl } from '@/app/actions/storage';
import type { ContractorJob } from '@/types/database.types';
import { formatDate } from '@/lib/format';

export default async function ContractorJobDetailPage({ params }: { params: { ticketId: string } }) {
  const profile = await requireRole(['contractor', 'admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  // Rich, RLS-safe job context (homeowner + property) comes from the definer
  // function, which only returns rows for the signed-in contractor.
  const { data: jobs } = await supabase.rpc('contractor_jobs');
  const job = ((jobs ?? []) as ContractorJob[]).find((j) => j.ticket_id === params.ticketId);
  if (!job) notFound();

  // The raw ticket row (project/unit ids) is readable via tickets_contractor_read.
  const { data: ticketRow } = await supabase.from('maintenance_tickets').select('unit_id, project_id').eq('id', params.ticketId).maybeSingle();
  const unitId = ticketRow?.unit_id ?? job.unit_id;
  const projectId = ticketRow?.project_id ?? null;

  const [{ data: photos }, { data: updates }, { data: messages }, { data: notes }, { data: materials }, { data: visits }] = await Promise.all([
    supabase.from('ticket_photos').select('id, storage_path').eq('ticket_id', params.ticketId),
    supabase.from('ticket_updates').select('id, note, status_change, created_at, profiles(full_name)').eq('ticket_id', params.ticketId).order('created_at', { ascending: false }),
    supabase.from('messages').select('id, sender_id, body, created_at, profiles(full_name)').eq('entity_type', 'ticket').eq('entity_id', params.ticketId).order('created_at', { ascending: true }),
    supabase.from('contractor_job_notes').select('id, body, created_at').eq('ticket_id', params.ticketId).order('created_at', { ascending: false }),
    supabase.from('material_requests').select('id, items, estimated_cost, status, note, created_at').eq('ticket_id', params.ticketId).order('created_at', { ascending: false }),
    supabase.from('contractor_visits').select('id, scheduled_for, completed_at, status, notes').eq('ticket_id', params.ticketId).order('scheduled_for', { ascending: false }),
  ]);

  const galleryItems = (photos ?? []).map((p) => ({ id: p.id, storage_path: p.storage_path, title: null as string | null }));
  const threadMessages: MessageItem[] = (messages ?? []).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    sender_name: m.sender_id === profile.id ? 'You' : (m as any).profiles?.full_name ?? 'Homeowner / Oramira',
    body: m.body,
    created_at: m.created_at,
  }));

  return (
    <div className="space-y-6">
      <Link href="/contractor" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Assigned Jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <PriorityBadge priority={job.priority} />
            {job.category && <span className="text-xs capitalize text-charcoal-600/60">{job.category}</span>}
            <TicketStatusBadge status={job.status} />
          </div>
          <h1 className="font-display text-3xl">{job.title}</h1>
        </div>
      </div>

      {/* Status action bar */}
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
        <JobStatusControl ticketId={job.ticket_id} status={job.status} />
        <CompletionPhotoUpload ticketId={job.ticket_id} unitId={unitId} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {job.description && (
            <div className="panel p-6">
              <h4 className="mb-2">Issue description</h4>
              <p className="text-sm leading-relaxed text-charcoal-600/80">{job.description}</p>
            </div>
          )}

          {galleryItems.length > 0 && (
            <div className="panel p-6">
              <h4 className="mb-4">Photos & video</h4>
              <ProjectGallery items={galleryItems} getUrl={getDocumentUrl.bind(null, 'defect-reports')} />
            </div>
          )}

          <div className="panel flex h-[32rem] flex-col p-6">
            <h4 className="mb-4">Homeowner messages</h4>
            <div className="flex-1 overflow-hidden">
              <MessageThread entityType="ticket" entityId={job.ticket_id} currentUserId={profile.id} initialMessages={threadMessages} />
            </div>
          </div>

          <InternalNotes ticketId={job.ticket_id} notes={(notes ?? []) as JobNote[]} />

          <div className="panel p-6">
            <h4 className="mb-4">Ticket history</h4>
            {(updates ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No updates yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-stone-line pl-5">
                {(updates ?? []).map((u) => (
                  <li key={u.id} className="relative">
                    <span className="absolute -left-[23px] top-1 h-2 w-2 rounded-full bg-forest" />
                    {u.status_change && <p className="text-sm font-medium capitalize text-charcoal">{u.status_change.replace(/_/g, ' ')}</p>}
                    <p className="text-sm text-charcoal-600/80">{u.note}</p>
                    <p className="mt-0.5 text-xs text-charcoal-600/50">{(u as any).profiles?.full_name ?? 'Oramira'} · {formatDate(u.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6">
            <h4 className="mb-4">Property & homeowner</h4>
            <div className="space-y-2.5 text-sm">
              <p className="flex items-center gap-2 text-charcoal"><User size={14} className="text-olive" strokeWidth={1.75} /> {job.homeowner_name ?? '—'}</p>
              <p className="flex items-center gap-2 text-charcoal-600"><MapPin size={14} className="text-olive" strokeWidth={1.75} /> {job.project_name ?? ''}{job.unit_number ? ` · Unit ${job.unit_number}` : ''}</p>
              {job.location && <p className="pl-6 text-xs text-charcoal-600/70">{job.location}</p>}
              {job.homeowner_phone && <p className="flex items-center gap-2 text-charcoal-600"><Phone size={14} className="text-olive" strokeWidth={1.75} /> <a href={`tel:${job.homeowner_phone}`} className="hover:text-forest">{job.homeowner_phone}</a></p>}
              {job.homeowner_email && <p className="flex items-center gap-2 text-charcoal-600"><Mail size={14} className="text-olive" strokeWidth={1.75} /> <a href={`mailto:${job.homeowner_email}`} className="hover:text-forest">{job.homeowner_email}</a></p>}
            </div>
          </div>

          <ScheduleVisitForm ticketId={job.ticket_id} unitId={unitId} visits={(visits ?? []) as VisitItem[]} />

          <MaterialRequestPanel ticketId={job.ticket_id} requests={(materials ?? []) as MaterialRequestRow[]} />

          <div className="panel p-6">
            <h4 className="mb-4">Invoice</h4>
            <InvoiceUploadForm ticketId={job.ticket_id} projectId={projectId} />
          </div>
        </div>
      </div>
    </div>
  );
}
