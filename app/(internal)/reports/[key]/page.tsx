import ReportsPage from '../page';

export const dynamic = 'force-dynamic';

/** /reports/<κλειδί>: ίδια σελίδα με τις κάρτες πάνω και την αναφορά από κάτω. */
export default function ReportByKey({ params, searchParams }: { params: { key: string }; searchParams: Record<string, string | undefined> }) {
  return <ReportsPage searchParams={{ ...searchParams, r: params.key }} />;
}
