import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, HardHat } from 'lucide-react';
import { MessageThread, type MessageItem } from '@/components/portal/MessageThread';
import { TicketStatusBadge, PriorityBadge } from '@/components/homeowner/TicketStatusBadge';
import { TicketOwnerActions } from '@/components/homeowner/TicketOwnerActions';
import { ProjectGallery } from '@/components/projects/ProjectGallery';
import { getDocumentUrl } from '@/app/actions/storage';

export default async function TicketDetailPage({ params }: { params: { ticketId: string } }) {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: ticket } = await supabase
    .from('maintenance_tickets')
    .select('id, title, description, category, status, priority, created_at, contractor_id, contractors(company_name)')
    .eq('id', params.ticketId)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: photos }, { data: updates }, { data: messages }, { data: visits }] = await Promise.all([
    supabase.from('ticket_photos').select('id, storage_path').eq('ticket_id', ticket.id),
    supabase.from('ticket_updates').select('id, note, status_change, created_at, profiles(full_name)').eq('ticket_id', ticket.id).order('created_at', { ascending: false }),
    supabase.from('messages').select('id, sender_id, body, created_at, profiles(full_name)').eq('entity_type', 'ticket').eq('entity_id', ticket.id).order('created_at', { ascending: true }),
    supabase.from('contractor_visits').select('id, scheduled_for, status').eq('ticket_id', ticket.id).order('scheduled_for', { ascending: false }),
  ]);

  const galleryItems = (photos ?? []).map((p) => ({ id: p.id, storage_path: p.storage_path, title: null as string | null }));
  const threadMessages: MessageItem[] = (messages ?? []).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    sender_name: m.sender_id === profile.id ? 'You' : (m as any).profiles?.full_name ?? 'Oramira team',
    body: m.body,
    created_at: m.created_at,
  }));
  const nextVisit = (visits ?? []).find((v) => v.status !== 'completed' && v.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <Link href="/homeowner/maintenance" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Maintenance
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow mb-1 capitalize">{ticket.category ?? 'general'}</p>
          <h1 className="font-display text-3xl">{ticket.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
        <TicketOwnerActions ticketId={ticket.id} status={ticket.status} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {ticket.description && (
            <div className="panel p-6">
              <h4 className="mb-2">Issue details</h4>
              <p className="text-sm leading-relaxed text-charcoal-600/80">{ticket.description}</p>
            </div>
          )}

          {galleryItems.length > 0 && (
            <div className="panel p-6">
              <h4 className="mb-4">Photos</h4>
              <ProjectGallery items={galleryItems} getUrl={getDocumentUrl.bind(null, 'defect-reports')} />
            </div>
          )}

          <div className="panel flex h-[34rem] flex-col p-6">
            <h4 className="mb-4">Messages</h4>
            <div className="flex-1 overflow-hidden">
              <MessageThread entityType="ticket" entityId={ticket.id} currentUserId={profile.id} initialMessages={threadMessages} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6">
            <h4 className="mb-4 flex items-center gap-2"><HardHat size={15} className="text-olive" strokeWidth={1.75} /> Assigned contractor</h4>
            {ticket.contractor_id ? (
              <div>
                <p className="text-sm font-medium text-charcoal">{(ticket as any).contractors?.company_name ?? 'Contractor'}</p>
                {nextVisit?.scheduled_for ? (
                  <p className="mt-1 text-xs text-charcoal-600/70">Next visit <span className="figure">{new Date(nextVisit.scheduled_for).toLocaleString()}</span></p>
                ) : (
                  <p className="mt-1 text-xs text-charcoal-600/60">Visit time to be confirmed</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-charcoal-600/70">Your Oramira team is assigning the right contractor.</p>
            )}
          </div>

          <div className="panel p-6">
            <h4 className="mb-4">Status updates</h4>
            {(updates ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No updates yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-stone-line pl-5">
                {(updates ?? []).map((u) => (
                  <li key={u.id} className="relative">
                    <span className="absolute -left-[23px] top-1 h-2 w-2 rounded-full bg-forest" />
                    {u.status_change && <p className="text-sm font-medium capitalize text-charcoal">{u.status_change.replace(/_/g, ' ')}</p>}
                    <p className="text-sm text-charcoal-600/80">{u.note}</p>
                    <p className="mt-0.5 text-xs text-charcoal-600/50">
                      {(u as any).profiles?.full_name ?? 'Oramira'} · {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
