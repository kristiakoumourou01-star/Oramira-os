import { requireRole } from '@/lib/auth';

export default async function InvestorOverviewPage() {
  const profile = await requireRole(['investor', 'admin', 'sales', 'management']);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Your portfolio</p>
        <h1 className="text-3xl font-display">Welcome, {profile.fullName}</h1>
      </div>
      <div className="panel p-6">
        <p className="text-sm text-charcoal-600">
          ROI tracking, capital appreciation estimates, and your document center will appear
          here once the Investor Dashboard module is built out.
        </p>
      </div>
    </div>
  );
}
