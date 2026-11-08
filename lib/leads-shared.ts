/** Client-safe lead types (no server imports). getEnrichedLeads lives in lib/leads.ts. */
export interface LeadListItem {
  id: string;
  contact_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  budget_min: number | null;
  budget_max: number | null;
  ai_score: number | null;
  last_contacted_at: string | null;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  assigned_at: string | null;
  next_action_date: string | null;
  next_action_type: string | null;
  next_follow_up: string | null;
  priority: number;
  priority_reasons: string[];
  needs_action: boolean;
  /** Pipeline fields (migration 0068). */
  pipeline?: string | null;
  stage_entered_at?: string | null;
  /** Το δικό του στάδιο στο pipeline (migration 0072). */
  stage?: string | null;
  /** Λόγος/αποτέλεσμα κλεισίματος (Lost, Not interested…). */
  lost_reason?: string | null;
  is_returning?: boolean;
}
