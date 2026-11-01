import { PageSkeleton } from '@/components/ui/PageSkeleton';

/**
 * Instant feedback for every internal page that has no loading screen of its
 * own: the menu stays, the content area shows a skeleton while the page loads.
 */
export default function Loading() {
  return <PageSkeleton />;
}
