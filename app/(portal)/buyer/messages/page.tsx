import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBuyerUnit } from '@/lib/buyer';
import { MessageSquare, Megaphone } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { BuyerMessageThread, type ThreadMessage } from '@/components/buyer/BuyerMessageThread';
import { formatDate } from '@/lib/format';

export default async function BuyerMessagesPage() {
  const profile = await requireRole(['buyer', 'admin', 'sales', 'management']);
  const unit = await getBuyerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Messaging opens with your unit"
        description="Once your unit is linked, you can message your Oramira team directly from here."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: messages }, { data: announcements }] = await Promise.all([
    supabase
      .from('messages')
      .select('id, sender_id, body, created_at, profiles(full_name)')
      .eq('entity_type', 'unit')
      .eq('entity_id', unit.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('announcements')
      .select('id, title, body, published_at')
      .or(`project_id.is.null,project_id.eq.${unit.project_id}`)
      .order('published_at', { ascending: false }),
  ]);

  const threadMessages: ThreadMessage[] = (messages ?? []).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    sender_name: m.sender_id === profile.id ? 'You' : (m as any).profiles?.full_name ?? 'Oramira team',
    body: m.body,
    created_at: m.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
        <h1 className="font-display text-3xl">Communication Center</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="panel col-span-2 p-6">
          <h4 className="mb-4">Messages with your Oramira team</h4>
          <BuyerMessageThread unitId={unit.id} currentUserId={profile.id} initialMessages={threadMessages} />
        </div>

        <div className="space-y-4">
          <h4 className="flex items-center gap-2"><Megaphone size={15} className="text-champagne-600" strokeWidth={1.75} /> Announcements</h4>
          {(announcements ?? []).length === 0 ? (
            <p className="text-sm text-charcoal-600/70">No announcements right now.</p>
          ) : (
            (announcements ?? []).map((a) => (
              <div key={a.id} className="panel p-5">
                <p className="text-sm font-medium text-charcoal">{a.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-charcoal-600/80">{a.body}</p>
                <p className="mt-2 text-xs text-charcoal-600/50">{formatDate(a.published_at)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
