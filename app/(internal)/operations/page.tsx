import { redirect } from 'next/navigation';

/** Το Operations ενώθηκε με το Command Center (Αρχική → Command Center). */
export default function OperationsPage() {
  redirect('/command-center');
}
