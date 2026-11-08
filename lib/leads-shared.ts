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
  /** Deal (migration 0075) — όπως στο Pipedrive. */
  title?: string | null;
  value?: number | null;
  currency?: string;
  expected_close_date?: string | null;
  labels?: string[];
  won_at?: string | null;
  lost_at?: string | null;
  archived_at?: string | null;
  in_inbox?: boolean;
  /** Η πιο κοντινή ανοιχτή activity (ημ/νία + τύπος). */
  next_activity_type?: string | null;
}

/** Η αξία του deal: η αξία που ορίστηκε, αλλιώς ο προϋπολογισμός. */
export const dealValue = (l: Pick<LeadListItem, 'value' | 'budget_max' | 'budget_min'>) => Number(l.value ?? l.budget_max ?? l.budget_min ?? 0) || 0;
/** Τίτλος deal: ο δικός του, αλλιώς το όνομα της επαφής. */
export const dealTitle = (l: Pick<LeadListItem, 'title' | 'full_name' | 'email'>) => (l.title ?? '').trim() || l.full_name || l.email || '—';
