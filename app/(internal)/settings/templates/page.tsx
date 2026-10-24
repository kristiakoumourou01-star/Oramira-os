import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TemplatesAdmin, type Template } from '@/components/comms/TemplatesAdmin';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

export default async function TemplatesPage() {
  await requirePermission('automation');
  const supabase = await createSupabaseServerClient();
  const { data: templates } = await supabase
    .from('message_templates')
    .select('id, channel, key, name, subject, body, is_active')
    .order('channel')
    .order('key');

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Admin" title="Message templates" description="WhatsApp & email templates used by automations and agent sends." />
      <TemplatesAdmin templates={(templates ?? []) as Template[]} />
    </div>
  );
}
