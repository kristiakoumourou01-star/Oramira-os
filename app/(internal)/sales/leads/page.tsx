import { redirect } from 'next/navigation';

/** Το παλιό «Leads Inbox» έγινε «Νέα leads» (Διαχείριση leads). */
export default function LeadsInboxRedirect() {
  redirect('/sales/new');
}
