import { redirect } from 'next/navigation';

/** Το Audit log μεταφέρθηκε στο Ο λογαριασμός μου → Audit log. */
export default function AuditSettingsPage() {
  redirect('/account?tab=audit');
}
