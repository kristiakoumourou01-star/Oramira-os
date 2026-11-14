import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DealWorkbench } from '@/components/deals/DealWorkbench';
import type { SavedScenario } from '@/components/deals/ScenarioPanel';
import { DEFAULT_DEAL_INPUTS, type DealInputs, type DealOutputs } from '@/lib/deal-analyzer';
import type { DealAdvisory } from '@/lib/ai';

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const me = await requirePermission('deals');
  const supabase = await createSupabaseServerClient();

  const { data: deal } = await supabase
    .from('deals')
    .select('id, name, status, project_id, inputs, ai_summary, ai_strengths, ai_weaknesses, ai_red_flags, ai_recommended_strategy, ai_suggested_pricing, ai_generated_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!deal) notFound();

  const { data: scenarioRows } = await supabase
    .from('deal_scenarios')
    .select('id, name, computed_outputs')
    .eq('deal_id', deal.id)
    .order('created_at', { ascending: true });

  // Stored inputs are merged over the defaults so an older/partial record still
  // resolves to a complete, computable input set.
  const inputs: DealInputs = { ...DEFAULT_DEAL_INPUTS, ...((deal.inputs as object) ?? {}) } as DealInputs;

  const scenarios: SavedScenario[] = (scenarioRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    computed_outputs: s.computed_outputs as unknown as DealOutputs,
  }));

  const advisory: DealAdvisory | null = deal.ai_generated_at
    ? {
        summary: deal.ai_summary ?? '',
        strengths: (deal.ai_strengths as unknown as string[]) ?? [],
        weaknesses: (deal.ai_weaknesses as unknown as string[]) ?? [],
        red_flags: (deal.ai_red_flags as unknown as string[]) ?? [],
        recommended_strategy: deal.ai_recommended_strategy ?? '',
        suggested_pricing: deal.ai_suggested_pricing ?? '',
      }
    : null;

  return (
    <div className="space-y-4">
      <Link href="/deal-analyzer" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Deal Analyzer
      </Link>
      <DealWorkbench
        canApprove={me.role === 'admin' || me.role === 'management'}
        dealId={deal.id}
        dealName={deal.name}
        status={deal.status}
        initialInputs={inputs}
        scenarios={scenarios}
        advisory={advisory}
        advisoryGeneratedAt={deal.ai_generated_at}
        projectId={deal.project_id}
      />
    </div>
  );
}
