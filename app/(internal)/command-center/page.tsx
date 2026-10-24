import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildCommandCenter } from '@/lib/command-center';
import { CommandCenterBoard } from '@/components/dashboard/CommandCenterBoard';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

/** The full Executive Command Center board — its own page (linked from the
 *  compact command bar on the dashboard). Leadership only. */
export default async function CommandCenterPage() {
  await requireRole(['admin', 'management']);
  const supabase = await createSupabaseServerClient();
  const data = await buildCommandCenter(supabase);

  return (
    <div className="space-y-5">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-charcoal-600/70 hover:text-forest"><ArrowLeft size={15} /> Dashboard</Link>
      <WorkspaceHeader eyebrow="Executive" title="Command Center" description="Live cross-module intelligence — priorities, risks, cashflow, bottlenecks, and what the system has learned." />
      <CommandCenterBoard data={data} />
    </div>
  );
}
