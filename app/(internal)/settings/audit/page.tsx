import { requireRole } from '@/lib/auth';
import { getAuditLog } from '@/lib/audit';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { AuditLogView } from '@/components/admin/AuditLogView';

/**
 * Settings → Audit log. Admin-only global access trail: every logged action
 * across all users and entities, including sign-in/out, with actor, role, IP
 * and device. Answers "ποιος, πότε, από πού".
 */
export default async function AuditSettingsPage() {
  await requireRole(['admin']);
  const rows = await getAuditLog(500);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="Admin"
        title="Audit log"
        description="Ιστορικό πρόσβασης & ενεργειών — ποιος, πότε, από πού (τελευταίες 500 εγγραφές)."
      />
      <AuditLogView rows={rows} />
    </div>
  );
}
