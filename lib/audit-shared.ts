/** Client-safe types for @/lib/audit (the server reads stay there). */

export interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  ip: string | null;
  ua: string | null;
}
