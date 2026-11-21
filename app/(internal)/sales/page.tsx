import { redirect } from 'next/navigation';

/** Διαχείριση leads → ανοίγει στο Pipeline. */
export default function SalesIndex() {
  redirect('/sales/deals');
}
