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
          default_lead_owner_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['organizations']['Row']>;
        Update: Partial<Database['public']['Tables']['organizations']['Row']>;
      };
      project_team_contacts: {
        Row: {
          id: string;
          project_id: string;
          role: string;
          name: string;
          email: string;
          phone: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['project_team_contacts']['Row']> & { project_id: string; role: string; name: string; email: string };
        Update: Partial<Database['public']['Tables']['project_team_contacts']['Row']>;
      };
      unit_ownership_history: {
        Row: {
          id: string;
          unit_id: string;
          previous_contact_id: string | null;
          new_contact_id: string | null;
          transfer_date: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['unit_ownership_history']['Row']> & { unit_id: string };
        Update: Partial<Database['public']['Tables']['unit_ownership_history']['Row']>;
      };
      leave_balances: {
        Row: {
          id: string;
          profile_id: string;
          leave_type: string;
          year: number;
          total_days: number;
          used_days: number;
        };
        Insert: Partial<Database['public']['Tables']['leave_balances']['Row']> & { profile_id: string; year: number };
        Update: Partial<Database['public']['Tables']['leave_balances']['Row']>;
      };
      leave_requests: {
        Row: {
          id: string;
          profile_id: string;
          leave_type: string;
          start_date: string;
          end_date: string;
          days: number | null;
          reason: string | null;
          status: string;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['leave_requests']['Row']> & { profile_id: string; start_date: string; end_date: string };
        Update: Partial<Database['public']['Tables']['leave_requests']['Row']>;
      };
      employee_contracts: {
        Row: {
          id: string;
          profile_id: string;
          type: string;
          title: string;
          document_id: string | null;
          status: string;
          start_date: string | null;
          expiry_date: string | null;
          probation_end_date: string | null;
          renewal_date: string | null;
          storage_path: string | null;
          bucket: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['employee_contracts']['Row']> & { profile_id: string; title: string };
        Update: Partial<Database['public']['Tables']['employee_contracts']['Row']>;
      };
      commissions: {
        Row: {
          id: string;
          profile_id: string;
          lead_id: string | null;
          unit_id: string | null;
          reservation_id: string | null;
          base_value: number | null;
          commission_pct: number | null;
          amount: number | null;
          status: string;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['commissions']['Row']> & { profile_id: string };
        Update: Partial<Database['public']['Tables']['commissions']['Row']>;
      };
      payslips: {
        Row: {
          id: string;
          profile_id: string;
          period: string;
          gross_amount: number | null;
          net_amount: number | null;
          currency: string;
          document_id: string | null;
          status: string;
          employer_cost: number | null;
          total_deductions: number | null;
          bonus: number | null;
          commission: number | null;
          advances: number | null;
          payment_date: string | null;
          breakdown: Json;
          approved_by: string | null;
          approved_at: string | null;
          pdf_path: string | null;
          issued_at: string;
        };
        Insert: Partial<Database['public']['Tables']['payslips']['Row']> & { profile_id: string; period: string };
        Update: Partial<Database['public']['Tables']['payslips']['Row']>;
      };
      lead_assignments: {
        Row: {
          id: string;
          lead_id: string;
          assigned_to: string | null;
          assigned_by: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['lead_assignments']['Row']> & { lead_id: string };
        Update: Partial<Database['public']['Tables']['lead_assignments']['Row']>;
      };
      profiles: {
        Row: {
          id: string;
          contact_id: string | null;
          contractor_id: string | null;
          role: 'admin' | 'sales' | 'management' | 'finance' | 'construction' | 'viewer' | 'buyer' | 'homeowner' | 'investor' | 'contractor';
          full_name: string | null;
          avatar_url: string | null;
          is_active: boolean;
          job_title: string | null;
          department: string | null;
          employment_start_date: string | null;
          work_schedule: string | null;
          agreed_salary: number | null;
          salary_basis: string | null;
          commission_pct: number | null;
          annual_leave_days: number | null;
          sick_leave_days: number | null;
          special_leave_days: number | null;
          unpaid_leave_days: number | null;
          phone: string | null;
          id_passport: string | null;
          address: string | null;
          emergency_contact: string | null;
          salary_frequency: string | null;
          bonus_structure: string | null;
          module_access: Json;
          benefits: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; role: Database['public']['Tables']['profiles']['Row']['role'] };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      org_branding: {
        Row: {
          id: string;
          company_name: string;
          logo_url: string | null;
          color_primary: string;
          color_accent: string;
          color_secondary: string;
          color_background: string;
          color_text: string;
          font_heading: string;
          font_body: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database['public']['Tables']['org_branding']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['org_branding']['Row']>;
      };
      contacts: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          nationality: string | null;
          preferred_language: string | null;
          buyer_type: string | null;
          communication_preference: string | null;
          nurture_style: string | null;
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
          assigned_by: string | null;
          assigned_at: string | null;
          next_action_date: string | null;
          next_action_type: string | null;
          first_response_at: string | null;
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
      viewings: {
        Row: {
          id: string;
          lead_id: string | null;
          contact_id: string;
          unit_id: string | null;
          project_id: string | null;
          agent_id: string | null;
          scheduled_at: string;
          status: string;
          notes: string | null;
          reminder_sent_at: string | null;
          follow_up_sent_at: string | null;
          meeting_link: string | null;
          google_event_id: string | null;
          calendar_synced_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['viewings']['Row']> & { contact_id: string; scheduled_at: string };
        Update: Partial<Database['public']['Tables']['viewings']['Row']>;
      };
      negotiations: {
        Row: {
          id: string;
          lead_id: string;
          unit_id: string | null;
          offered_price: number | null;
          counter_offer: number | null;
          agreed_price: number | null;
          payment_terms: string | null;
          reservation_deposit: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['negotiations']['Row']> & { lead_id: string };
        Update: Partial<Database['public']['Tables']['negotiations']['Row']>;
      };
      contact_communications: {
        Row: {
          id: string;
          contact_id: string;
          lead_id: string | null;
          channel: string;
          direction: string;
          summary: string | null;
          body: string | null;
          status: string;
          provider: string | null;
          provider_message_id: string | null;
          template_key: string | null;
          ai_generated: boolean;
          delivered_at: string | null;
          read_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          error: string | null;
          occurred_at: string;
          logged_by: string | null;
        };
        Insert: Partial<Database['public']['Tables']['contact_communications']['Row']> & {
          contact_id: string; channel: string; direction: string;
        };
        Update: Partial<Database['public']['Tables']['contact_communications']['Row']>;
      };
      message_templates: {
        Row: {
          id: string;
          channel: string;
          key: string;
          audience: string;
          name: string;
          subject: string | null;
          body: string;
          is_active: boolean;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['message_templates']['Row']> & { channel: string; key: string; name: string; body: string };
        Update: Partial<Database['public']['Tables']['message_templates']['Row']>;
      };
      integrations: {
        Row: {
          id: string;
          channel: string;
          provider: string;
          config: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['integrations']['Row']> & { channel: string; provider: string };
        Update: Partial<Database['public']['Tables']['integrations']['Row']>;
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
          meeting_link: string | null;
          google_event_id: string | null;
          calendar_synced_at: string | null;
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
          description: string | null;
          status: string;
          development_type: string;
          delivery_date: string | null;
          common_areas: string | null;
          maintenance_schedule: string | null;
          management_contact: string | null;
          emergency_contact: string | null;
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
          internal_sqm: number | null;
          covered_veranda_sqm: number | null;
          uncovered_veranda_sqm: number | null;
          storage_sqm: number | null;
          parking_spaces: number | null;
          plot_size_sqm: number | null;
          garden_sqm: number | null;
          has_pool: boolean | null;
          map_x: number | null;
          map_y: number | null;
          construction_progress: number | null;
          utility_water: string | null;
          utility_electricity: string | null;
          utility_internet: string | null;
          handover_checklist: Json;
          status: 'available' | 'reserved' | 'sold' | 'handed_over' | 'blocked';
          buyer_contact_id: string | null;
          handover_status: string;
          handover_date: string | null;
          warranty_start_date: string | null;
          warranty_period_months: number;
          title_deed_status: string;
          occupancy_status: string;
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
      project_media: {
        Row: {
          id: string;
          project_id: string;
          building_id: string | null;
          floor: number | null;
          kind: string;
          title: string | null;
          bucket: string;
          storage_path: string;
          sort: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['project_media']['Row']> & { project_id: string; kind: string; storage_path: string };
        Update: Partial<Database['public']['Tables']['project_media']['Row']>;
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
      calendar_events: {
        Row: {
          id: string;
          profile_id: string;
          title: string;
          type: string;
          start_at: string;
          duration_min: number | null;
          priority: string;
          color: string | null;
          related_lead_id: string | null;
          related_property_id: string | null;
          related_client_id: string | null;
          recurring_rule: string | null;
          reminder_minutes: number | null;
          status: string;
          location: string | null;
          notes: string | null;
          meeting_link: string | null;
          google_event_id: string | null;
          calendar_synced_at: string | null;
          attendees: Json;
          parent_event_id: string | null;
          source: string | null;
          source_key: string | null;
          recurs_until: string | null;
          excluded_dates: Json;
          reminder_sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['calendar_events']['Row']> & { profile_id: string; title: string; start_at: string };
        Update: Partial<Database['public']['Tables']['calendar_events']['Row']>;
      };
      calendar_connections: {
        Row: {
          id: string; profile_id: string; provider: string;
          access_token: string | null; refresh_token: string | null; token_expiry: string | null;
          calendar_id: string | null; email: string | null; created_at: string; updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['calendar_connections']['Row']> & { profile_id: string };
        Update: Partial<Database['public']['Tables']['calendar_connections']['Row']>;
      };
      tasks: {
        Row: {
          id: string; title: string; description: string | null; assigned_to: string | null;
          related_entity_type: string | null; related_entity_id: string | null; due_at: string | null;
          is_done: boolean; meeting_link: string | null; google_event_id: string | null; calendar_synced_at: string | null; source_key: string | null; created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tasks']['Row']> & { title: string };
        Update: Partial<Database['public']['Tables']['tasks']['Row']>;
      };
      learning_insights: {
        Row: { id: string; kind: string; payload: Json; sample_size: number; computed_at: string };
        Insert: Partial<Database['public']['Tables']['learning_insights']['Row']> & { kind: string };
        Update: Partial<Database['public']['Tables']['learning_insights']['Row']>;
      };
      institutional_memory: {
        Row: { id: string; kind: string; title: string; body: string; entity_type: string | null; entity_id: string | null; tags: string[]; importance: string; source_key: string | null; created_by: string | null; created_at: string };
        Insert: Partial<Database['public']['Tables']['institutional_memory']['Row']> & { kind: string; title: string };
        Update: Partial<Database['public']['Tables']['institutional_memory']['Row']>;
      };
      land_parcels: {
        Row: {
          id: string; contact_id: string | null; reference: string; location: string | null; area_ref: string | null; plot_size_sqm: number | null;
          stage: string;
          location_quality: number | null; planning_uplift: number | null; frontage_m: number | null; access_quality: string | null; plot_shape: string | null; density_potential: number | null; zone: string | null; building_density: number | null;
          seller_urgency: number | null; reason_for_selling: string | null; flexibility: number | null; financial_pressure: boolean; inheritance: boolean; family_split: boolean;
          current_value: number | null; post_planning_value: number | null; asking_price: number | null; offer_amount: number | null;
          assigned_to: string | null; next_action_date: string | null; last_contacted_at: string | null; notes: string | null; created_by: string | null; created_at: string;
          latitude: number | null; longitude: number | null; due_diligence: Json; offer_inputs: Json | null;
          relocation: boolean; divorce: boolean; debt_pressure: boolean; timeline_to_sell: string | null;
        };
        Insert: Partial<Database['public']['Tables']['land_parcels']['Row']> & { reference: string };
        Update: Partial<Database['public']['Tables']['land_parcels']['Row']>;
      };
      parcel_documents: {
        Row: { id: string; parcel_id: string; category: string; name: string; url: string | null; note: string | null; uploaded_by: string | null; created_at: string };
        Insert: Partial<Database['public']['Tables']['parcel_documents']['Row']> & { parcel_id: string; category: string; name: string };
        Update: Partial<Database['public']['Tables']['parcel_documents']['Row']>;
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
          onboarding: Json;
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
