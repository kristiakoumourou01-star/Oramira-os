import { PageSkeleton } from '@/components/ui/PageSkeleton';
export default function Loading() {
  return (
    <div className="-mx-6 -my-5 min-h-screen bg-[#F7F4EE] px-6 py-5">
      <PageSkeleton />
    </div>
  );
}
