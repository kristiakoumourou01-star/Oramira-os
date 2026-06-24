/**
 * Hand-authored types for the scaffold phase. Once migrations have been
 * run against a real Supabase project, regenerate this file properly with:
 *
 *   npm run supabase:types
 *
 * which calls `supabase gen types typescript` and produces a fully
 * accurate, exhaustive Database type from the live schema. This file
 * covers only the tables touched by the current scaffold so the app
 * type-checks cleanly until that happens.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          notification_settings: Json;
          settings: Json;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['organizations']['Row']>;
        Update: Partial<Database['public']['Tables']['organizations']['Row']>;
      };
      profiles: {
        Row: {
          id: string;
          contact_id: string | null;
          contractor_id: string | null;
          role: 'admin' | 'sales' | 'management' | 'buyer' | 'homeowner' | 'investor' | 'contractor';
          full_name: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; role: Database['public']['Tables']['profiles']['Row']['role'] };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      contacts: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          nationality: string | null;
          first_touch_source: string | null;
          is_lead: boolean;
          is_buyer: boolean;
          is_investor: boolean;
          is_homeowner: boolean;
          is_newsletter_subscriber: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contacts']['Row']> & { email: string };
        Update: Partial<Database['public']['Tables']['contacts']['Row']>;
      };
      website_submissions: {
        Row: {
          id: string;
          type: string;
          name: string | null;
          email: string;
          phone: string | null;
          budget: string | null;
          project_interest_id: string | null;
          message: string | null;
          source: string;
          contact_id: string | null;
          lead_id: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['website_submissions']['Row']> & { type: string; email: string };
        Update: Partial<Database['public']['Tables']['website_submissions']['Row']>;
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          contact_id: string;
          email: string;
          source: string;
          tags: string[];
          subscribed_at: string;
          unsubscribed_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['newsletter_subscribers']['Row']> & { contact_id: string; email: string };
        Update: Partial<Database['public']['Tables']['newsletter_subscribers']['Row']>;
      };
      leads: {
        Row: {
          id: string;
          contact_id: string;
          status: string;
          source: string;
          budget_min: number | null;
          budget_max: number | null;
          preferred_project_id: string | null;
          timeline_to_buy: string | null;
          message: string | null;
          assigned_to: string | null;
          ai_score: number | null;
          ai_score_reasoning: string | null;
          ai_summary: string | null;
          ai_next_steps: string | null;
          ai_summary_generated_at: string | null;
          last_contacted_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['leads']['Row']> & { contact_id: string; source: string };
        Update: Partial<Database['public']['Tables']['leads']['Row']>;
      };
      contact_communications: {
        Row: {
          id: string;
          contact_id: string;
          channel: string;
          direction: string;
          summary: string | null;
          occurred_at: string;
          logged_by: string | null;
        };
        Insert: Partial<Database['public']['Tables']['contact_communications']['Row']> & {
          contact_id: string; channel: string; direction: string;
        };
        Update: Partial<Database['public']['Tables']['contact_communications']['Row']>;
      };
      follow_up_tasks: {
        Row: {
          id: string;
          lead_id: string | null;
          contact_id: string | null;
          assigned_to: string | null;
          due_at: string;
          note: string | null;
          is_done: boolean;
          reminder_sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['follow_up_tasks']['Row']> & { due_at: string };
        Update: Partial<Database['public']['Tables']['follow_up_tasks']['Row']>;
      };
      investors: {
        Row: {
          id: string;
          contact_id: string;
          investor_type: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['investors']['Row']> & { contact_id: string };
        Update: Partial<Database['public']['Tables']['investors']['Row']>;
      };
      investor_holdings: {
        Row: {
          id: string;
          investor_id: string;
          unit_id: string | null;
          project_id: string | null;
          capital_invested: number | null;
          ownership_percentage: number | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['investor_holdings']['Row']> & { investor_id: string };
        Update: Partial<Database['public']['Tables']['investor_holdings']['Row']>;
      };
      reservations: {
        Row: {
          id: string;
          unit_id: string;
          buyer_contact_id: string;
          reserved_at: string;
          deposit_amount: number | null;
          deposit_paid: boolean;
          status: string;
          expires_at: string | null;
          expired_at: string | null;
          converted_contract_id: string | null;
          created_by: string | null;
        };
        Insert: Partial<Database['public']['Tables']['reservations']['Row']> & { unit_id: string; buyer_contact_id: string };
        Update: Partial<Database['public']['Tables']['reservations']['Row']>;
      };
      contracts: {
        Row: {
          id: string;
          unit_id: string;
          buyer_contact_id: string;
          reservation_id: string | null;
          status: 'draft' | 'sent' | 'signed' | 'cancelled';
          document_id: string | null;
          signed_at: string | null;
          total_price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contracts']['Row']> & { unit_id: string; buyer_contact_id: string };
        Update: Partial<Database['public']['Tables']['contracts']['Row']>;
      };
      payments: {
        Row: {
          id: string;
          payment_schedule_id: string | null;
          contract_id: string;
          amount_paid: number;
          paid_at: string;
          method: string | null;
          reference: string | null;
          recorded_by: string | null;
        };
        Insert: Partial<Database['public']['Tables']['payments']['Row']> & { contract_id: string; amount_paid: number };
        Update: Partial<Database['public']['Tables']['payments']['Row']>;
      };
      buyers: {
        Row: {
          id: string;
          contact_id: string;
          portal_eligible: boolean;
          portal_activated: boolean;
          portal_activated_at: string | null;
          notes: string | null;
        };
        Insert: Partial<Database['public']['Tables']['buyers']['Row']> & { contact_id: string };
        Update: Partial<Database['public']['Tables']['buyers']['Row']>;
      };
      projects: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          location: string | null;
          status: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['projects']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['projects']['Row']>;
      };
      units: {
        Row: {
          id: string;
          project_id: string;
          building_id: string | null;
          phase_id: string | null;
          unit_number: string;
          floor: number | null;
          type: string | null;
          sqm: number | null;
          price: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          internal_specs: Json;
          description: string | null;
          floorplan_document_id: string | null;
          status: 'available' | 'reserved' | 'sold' | 'handed_over' | 'blocked';
          buyer_contact_id: string | null;
          handover_status: string;
          handover_date: string | null;
          warranty_start_date: string | null;
          warranty_period_months: number;
          title_deed_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['units']['Row']> & { project_id: string; unit_number: string };
        Update: Partial<Database['public']['Tables']['units']['Row']>;
      };
      warranties: {
        Row: {
          id: string;
          unit_id: string;
          category: string;
          starts_on: string;
          ends_on: string;
          notes: string | null;
        };
        Insert: Partial<Database['public']['Tables']['warranties']['Row']> & {
          unit_id: string; category: string; starts_on: string; ends_on: string;
        };
        Update: Partial<Database['public']['Tables']['warranties']['Row']>;
      };
      announcements: {
        Row: {
          id: string;
          project_id: string | null;
          title: string;
          body: string;
          audience: string;
          published_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['announcements']['Row']> & { title: string; body: string };
        Update: Partial<Database['public']['Tables']['announcements']['Row']>;
      };
      handover_checklist_items: {
        Row: {
          id: string;
          unit_id: string;
          label: string;
          description: string | null;
          sequence: number;
          is_complete: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['handover_checklist_items']['Row']> & { unit_id: string; label: string };
        Update: Partial<Database['public']['Tables']['handover_checklist_items']['Row']>;
      };
      buildings: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          floors: number | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['buildings']['Row']> & { project_id: string; name: string };
        Update: Partial<Database['public']['Tables']['buildings']['Row']>;
      };
      project_phases: {
        Row: {
          id: string;
          project_id: string;
          building_id: string | null;
          name: string;
          sequence: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['project_phases']['Row']> & { project_id: string; name: string };
        Update: Partial<Database['public']['Tables']['project_phases']['Row']>;
      };
      project_milestones: {
        Row: {
          id: string;
          project_id: string;
          phase_id: string | null;
          milestone_type: 'permits' | 'excavation' | 'structure' | 'mep' | 'finishes' | 'delivery';
          status: 'not_started' | 'in_progress' | 'delayed' | 'complete';
          planned_start: string | null;
          planned_end: string | null;
          actual_start: string | null;
          actual_end: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['project_milestones']['Row']> & {
          project_id: string; milestone_type: Database['public']['Tables']['project_milestones']['Row']['milestone_type'];
        };
        Update: Partial<Database['public']['Tables']['project_milestones']['Row']>;
      };
      contractor_project_assignments: {
        Row: {
          id: string;
          contractor_id: string;
          project_id: string;
          trade: string | null;
          assigned_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contractor_project_assignments']['Row']> & {
          contractor_id: string; project_id: string;
        };
        Update: Partial<Database['public']['Tables']['contractor_project_assignments']['Row']>;
      };
      payment_schedules: {
        Row: {
          id: string;
          contract_id: string;
          installment_number: number;
          description: string | null;
          due_date: string | null;
          amount: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['payment_schedules']['Row']> & {
          contract_id: string; installment_number: number; amount: number;
        };
        Update: Partial<Database['public']['Tables']['payment_schedules']['Row']>;
      };
      maintenance_tickets: {
        Row: {
          id: string;
          homeowner_id: string;
          unit_id: string;
          project_id: string;
          contractor_id: string | null;
          title: string;
          description: string | null;
          category: string | null;
          warranty_id: string | null;
          status: 'open' | 'acknowledged' | 'in_progress' | 'awaiting_parts' | 'resolved' | 'closed' | 'reopened';
          priority: 'low' | 'medium' | 'high' | 'emergency';
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['maintenance_tickets']['Row']> & {
          homeowner_id: string; unit_id: string; project_id: string; title: string;
        };
        Update: Partial<Database['public']['Tables']['maintenance_tickets']['Row']>;
      };
      homeowners: {
        Row: {
          id: string;
          contact_id: string;
          unit_id: string;
          moved_in_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['homeowners']['Row']> & { contact_id: string; unit_id: string };
        Update: Partial<Database['public']['Tables']['homeowners']['Row']>;
      };
      ticket_photos: {
        Row: {
          id: string;
          ticket_id: string;
          storage_path: string;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['ticket_photos']['Row']> & { ticket_id: string; storage_path: string };
        Update: Partial<Database['public']['Tables']['ticket_photos']['Row']>;
      };
      ticket_updates: {
        Row: {
          id: string;
          ticket_id: string;
          author_id: string | null;
          note: string;
          status_change: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['ticket_updates']['Row']> & { ticket_id: string; note: string };
        Update: Partial<Database['public']['Tables']['ticket_updates']['Row']>;
      };
      contractor_visits: {
        Row: {
          id: string;
          ticket_id: string | null;
          unit_id: string;
          contractor_id: string | null;
          scheduled_for: string | null;
          completed_at: string | null;
          status: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contractor_visits']['Row']> & { unit_id: string };
        Update: Partial<Database['public']['Tables']['contractor_visits']['Row']>;
      };
      contractor_invoices: {
        Row: {
          id: string;
          contractor_id: string;
          project_id: string | null;
          ticket_id: string | null;
          amount: number;
          document_id: string | null;
          status: string;
          submitted_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contractor_invoices']['Row']> & { contractor_id: string; amount: number };
        Update: Partial<Database['public']['Tables']['contractor_invoices']['Row']>;
      };
      contractor_performance_notes: {
        Row: {
          id: string;
          contractor_id: string;
          project_id: string | null;
          rating: number | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contractor_performance_notes']['Row']> & { contractor_id: string };
        Update: Partial<Database['public']['Tables']['contractor_performance_notes']['Row']>;
      };
      material_requests: {
        Row: {
          id: string;
          ticket_id: string;
          contractor_id: string;
          items: Json;
          estimated_cost: number | null;
          status: string;
          note: string | null;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['material_requests']['Row']> & { ticket_id: string; contractor_id: string };
        Update: Partial<Database['public']['Tables']['material_requests']['Row']>;
      };
      contractor_job_notes: {
        Row: {
          id: string;
          ticket_id: string;
          contractor_id: string;
          body: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contractor_job_notes']['Row']> & { ticket_id: string; contractor_id: string; body: string };
        Update: Partial<Database['public']['Tables']['contractor_job_notes']['Row']>;
      };
      deals: {
        Row: {
          id: string;
          name: string;
          project_id: string | null;
          created_by: string | null;
          status: string;
          inputs: Json;
          outputs: Json;
          unit_mix: Json;
          risk_breakdown: Json;
          // mirrored headline figures (for list views / reporting)
          total_buildable_sqm: number | null;
          sellable_sqm: number | null;
          estimated_units: number | null;
          gdv: number | null;
          total_project_cost: number | null;
          gross_profit: number | null;
          net_profit: number | null;
          roi: number | null;
          profit_margin: number | null;
          break_even_price_per_sqm: number | null;
          risk_score: number | null;
          // AI advisory
          ai_summary: string | null;
          ai_strengths: Json;
          ai_weaknesses: Json;
          ai_red_flags: Json;
          ai_recommended_strategy: string | null;
          ai_suggested_pricing: string | null;
          ai_generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['deals']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['deals']['Row']>;
      };
      deal_scenarios: {
        Row: {
          id: string;
          deal_id: string;
          name: string;
          overrides: Json;
          computed_outputs: Json;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['deal_scenarios']['Row']> & {
          deal_id: string; name: string; overrides: Json; computed_outputs: Json;
        };
        Update: Partial<Database['public']['Tables']['deal_scenarios']['Row']>;
      };
      automation_runs: {
        Row: {
          id: string;
          job: string;
          status: string;
          processed: number;
          summary: string | null;
          details: Json;
          error: string | null;
          triggered_by: string;
          started_at: string;
          finished_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['automation_runs']['Row']> & { job: string };
        Update: Partial<Database['public']['Tables']['automation_runs']['Row']>;
      };
      construction_tasks: {
        Row: {
          id: string;
          project_id: string;
          contractor_id: string | null;
          title: string;
          status: string;
          priority: 'low' | 'medium' | 'high' | 'emergency';
          deadline: string | null;
        };
        Insert: Partial<Database['public']['Tables']['construction_tasks']['Row']> & { project_id: string; title: string };
        Update: Partial<Database['public']['Tables']['construction_tasks']['Row']>;
      };
      contractors: {
        Row: {
          id: string;
          company_name: string;
          trade: string | null;
          region: string | null;
          is_available: boolean;
          is_active: boolean;
        };
        Insert: Partial<Database['public']['Tables']['contractors']['Row']> & { company_name: string };
        Update: Partial<Database['public']['Tables']['contractors']['Row']>;
      };
      documents: {
        Row: {
          id: string;
          category: string;
          storage_path: string;
          bucket: string;
          entity_type: string;
          entity_id: string;
          title: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['documents']['Row']> & {
          category: string; storage_path: string; bucket: string; entity_type: string; entity_id: string;
        };
        Update: Partial<Database['public']['Tables']['documents']['Row']>;
      };
      notes: {
        Row: { id: string; entity_type: string; entity_id: string; author_id: string | null; body: string; created_at: string };
        Insert: Partial<Database['public']['Tables']['notes']['Row']> & { entity_type: string; entity_id: string; body: string };
        Update: Partial<Database['public']['Tables']['notes']['Row']>;
      };
      activity_log: {
        Row: { id: string; entity_type: string; entity_id: string; actor_id: string | null; action: string; metadata: Json; created_at: string };
        Insert: Partial<Database['public']['Tables']['activity_log']['Row']> & { entity_type: string; entity_id: string; action: string };
        Update: Partial<Database['public']['Tables']['activity_log']['Row']>;
      };
      tasks: {
        Row: {
          id: string; title: string; description: string | null; assigned_to: string | null;
          related_entity_type: string | null; related_entity_id: string | null; due_at: string | null;
          is_done: boolean; created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tasks']['Row']> & { title: string };
        Update: Partial<Database['public']['Tables']['tasks']['Row']>;
      };
      notifications: {
        Row: { id: string; user_id: string; channel: 'in_app' | 'email'; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & { user_id: string; channel: 'in_app' | 'email'; title: string };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      notification_events: {
        Row: { id: string; trigger_type: string; entity_type: string | null; entity_id: string | null; channel: 'in_app' | 'email'; recipient: string; payload: Json; status: string; created_at: string };
        Insert: Partial<Database['public']['Tables']['notification_events']['Row']> & { trigger_type: string; channel: 'in_app' | 'email'; recipient: string };
        Update: Partial<Database['public']['Tables']['notification_events']['Row']>;
      };
      messages: {
        Row: { id: string; entity_type: string; entity_id: string; sender_id: string; body: string; created_at: string };
        Insert: Partial<Database['public']['Tables']['messages']['Row']> & { entity_type: string; entity_id: string; sender_id: string; body: string };
        Update: Partial<Database['public']['Tables']['messages']['Row']>;
      };
      invites: {
        Row: {
          id: string; email: string; role: string; contact_id: string | null;
          related_entity_type: string | null; related_entity_id: string | null;
          token: string; status: string; expires_at: string; accepted_at: string | null; created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['invites']['Row']> & { email: string; role: string; token: string; expires_at: string };
        Update: Partial<Database['public']['Tables']['invites']['Row']>;
      };
    };
    Functions: {
      find_or_create_contact: {
        Args: { p_email: string; p_name?: string | null; p_phone?: string | null };
        Returns: string;
      };
      accept_invite: {
        Args: { invite_token: string; new_user_id: string };
        Returns: void;
      };
      expire_stale_reservations: {
        Args: Record<string, never>;
        Returns: number;
      };
      contractor_avg_rating: {
        Args: Record<string, never>;
        Returns: number | null;
      };
      contractor_jobs: {
        Args: Record<string, never>;
        Returns: {
          ticket_id: string;
          title: string;
          description: string | null;
          category: string | null;
          status: 'open' | 'acknowledged' | 'in_progress' | 'awaiting_parts' | 'resolved' | 'closed' | 'reopened';
          priority: 'low' | 'medium' | 'high' | 'emergency';
          created_at: string;
          resolved_at: string | null;
          unit_id: string;
          unit_number: string;
          project_name: string | null;
          location: string | null;
          homeowner_name: string | null;
          homeowner_phone: string | null;
          homeowner_email: string | null;
        }[];
      };
      suggest_contractors: {
        Args: { p_trade: string; p_project_id: string };
        Returns: {
          contractor_id: string;
          company_name: string;
          score: number;
          is_available: boolean;
          open_assignments: number;
          avg_rating: number;
          same_region: boolean;
          same_project_history: boolean;
        }[];
      };
    };
  };
}

/** Row type returned by the contractor_jobs() RPC (a SETOF function). */
export type ContractorJob = Database['public']['Functions']['contractor_jobs']['Returns'][number];
