import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TemplatesAdmin, type Template } from '@/components/comms/TemplatesAdmin';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

export default async function TemplatesPage() {
  await requirePermission('automation');
  const supabase = await createSupabaseServerClient();
  const { data: templates } = await supabase
    .from('message_templates')
    .select('id, channel, key, name, subject, body, is_active, audience')
    .order('channel')
    .order('key')
    .order('audience');

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Admin" title="Πρότυπα μηνυμάτων" description="WhatsApp & email που στέλνουν οι αυτοματισμοί και οι πωλητές — σε κάθε γλώσσα που μιλούν οι πελάτες σας." />
      <TemplatesAdmin templates={(templates ?? []) as Template[]} />
    </div>
  );
}
