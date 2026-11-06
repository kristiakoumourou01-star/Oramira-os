import { redirect } from 'next/navigation';

/** Developments are now a selector inside the single Property Management hub. */
export default function DevelopmentRedirect({ params }: { params: { id: string } }) {
  redirect(`/property?dev=${params.id}`);
}
