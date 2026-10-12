export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_provider_policies: {
        Row: { provider_key: string; enabled: boolean; daily_company_limit: number; hourly_campaign_limit: number; daily_budget_usd: number | null; consecutive_failures: number; blocked_until: string | null; updated_at: string }
        Insert: { provider_key: string; enabled?: boolean; daily_company_limit: number; hourly_campaign_limit: number; daily_budget_usd?: number | null; consecutive_failures?: number; blocked_until?: string | null; updated_at?: string }
        Update: { provider_key?: string; enabled?: boolean; daily_company_limit?: number; hourly_campaign_limit?: number; daily_budget_usd?: number | null; consecutive_failures?: number; blocked_until?: string | null; updated_at?: string }
        Relationships: []
      }
      api_rate_limit_hour_windows: {
        Row: { campaign_id: string; company_id: string; provider_key: string; window_start: string; calls_used: number; updated_at: string }
        Insert: { campaign_id: string; company_id: string; provider_key: string; window_start: string; calls_used?: number; updated_at?: string }
        Update: { campaign_id?: string; company_id?: string; provider_key?: string; window_start?: string; calls_used?: number; updated_at?: string }
        Relationships: []
      }
      api_rate_limit_windows: {
        Row: { company_id: string; provider_key: string; window_start: string; calls_used: number; updated_at: string }
        Insert: { company_id: string; provider_key: string; window_start: string; calls_used?: number; updated_at?: string }
        Update: { company_id?: string; provider_key?: string; window_start?: string; calls_used?: number; updated_at?: string }
        Relationships: []
      }
      brand_campaign_creatives: {
        Row: { id: string; campaign_id: string; company_id: string; content: Json; generated_model: string | null; approval_state: string; created_at: string; updated_at: string; revision: number; plan_revision: number | null; plan_updated_at: string | null; approved_at: string | null; approved_by: string | null }
        Insert: { id?: string; campaign_id: string; company_id: string; content?: Json; generated_model?: string | null; approval_state?: string; created_at?: string; updated_at?: string; revision?: number; plan_revision?: number | null; plan_updated_at?: string | null; approved_at?: string | null; approved_by?: string | null }
        Update: { id?: string; campaign_id?: string; company_id?: string; content?: Json; generated_model?: string | null; approval_state?: string; created_at?: string; updated_at?: string; revision?: number; plan_revision?: number | null; plan_updated_at?: string | null; approved_at?: string | null; approved_by?: string | null }
        Relationships: []
      }
      brand_campaign_creator_selections: {
        Row: { id: string; company_id: string; campaign_id: string; catalog_id: string; rate_id: string; creator_name_snapshot: string; deliverable_type: string; quantity: number; unit_rate_cents: number; currency: string; selected_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; company_id: string; campaign_id: string; catalog_id: string; rate_id: string; creator_name_snapshot: string; deliverable_type: string; quantity: number; unit_rate_cents: number; currency?: string; selected_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; company_id?: string; campaign_id?: string; catalog_id?: string; rate_id?: string; creator_name_snapshot?: string; deliverable_type?: string; quantity?: number; unit_rate_cents?: number; currency?: string; selected_by?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      brand_campaign_metrics: {
        Row: { id: string; company_id: string; campaign_id: string; metric_date: string; platform: string; external_post_id: string; source_type: string; source_reference: string; views: number | null; impressions: number | null; engagements: number | null; clicks: number | null; conversions: number | null; spend_cents: number | null; revenue_cents: number | null; currency: string; recorded_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; company_id: string; campaign_id: string; metric_date: string; platform: string; external_post_id: string; source_type: string; source_reference: string; views?: number | null; impressions?: number | null; engagements?: number | null; clicks?: number | null; conversions?: number | null; spend_cents?: number | null; revenue_cents?: number | null; currency?: string; recorded_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; company_id?: string; campaign_id?: string; metric_date?: string; platform?: string; external_post_id?: string; source_type?: string; source_reference?: string; views?: number | null; impressions?: number | null; engagements?: number | null; clicks?: number | null; conversions?: number | null; spend_cents?: number | null; revenue_cents?: number | null; currency?: string; recorded_by?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      brand_campaign_plans: {
        Row: { id: string; campaign_id: string; company_id: string; brief: Json; approval_state: string; generated_model: string | null; generated_at: string | null; approved_at: string | null; created_at: string; updated_at: string; revision: number }
        Insert: { id?: string; campaign_id: string; company_id: string; brief?: Json; approval_state?: string; generated_model?: string | null; generated_at?: string | null; approved_at?: string | null; created_at?: string; updated_at?: string; revision?: number }
        Update: { id?: string; campaign_id?: string; company_id?: string; brief?: Json; approval_state?: string; generated_model?: string | null; generated_at?: string | null; approved_at?: string | null; created_at?: string; updated_at?: string; revision?: number }
        Relationships: []
      }
      brand_campaigns: {
        Row: { id: string; company_id: string; created_by: string; title: string; brand_name: string; website_url: string | null; logo_key: string | null; promoted_item: string; objective: string; deliverables: string[]; status: string; created_at: string; updated_at: string; requested_budget_cents: number | null; actual_live_at: string | null; completed_at: string | null }
        Insert: { id?: string; company_id: string; created_by: string; title: string; brand_name: string; website_url?: string | null; logo_key?: string | null; promoted_item: string; objective: string; deliverables?: string[]; status?: string; created_at?: string; updated_at?: string; requested_budget_cents?: number | null; actual_live_at?: string | null; completed_at?: string | null }
        Update: { id?: string; company_id?: string; created_by?: string; title?: string; brand_name?: string; website_url?: string | null; logo_key?: string | null; promoted_item?: string; objective?: string; deliverables?: string[]; status?: string; created_at?: string; updated_at?: string; requested_budget_cents?: number | null; actual_live_at?: string | null; completed_at?: string | null }
        Relationships: []
      }
      brand_competitor_observations: {
        Row: { id: string; company_id: string; scan_id: string; competitor_name: string; competitor_domain: string | null; source_url: string; source_domain: string; source_title: string; source_snippet: string; published_at: string | null; observed_at: string; content_hash: string; created_at: string; competitor_id: string | null; evidence_kind: string; source_record_key: string; source_date_text: string | null; provider_search_id: string | null; attributes: Json }
        Insert: { id?: string; company_id: string; scan_id: string; competitor_name: string; competitor_domain?: string | null; source_url: string; source_domain: string; source_title: string; source_snippet: string; published_at?: string | null; observed_at?: string; content_hash: string; created_at?: string; competitor_id?: string | null; evidence_kind?: string; source_record_key: string; source_date_text?: string | null; provider_search_id?: string | null; attributes?: Json }
        Update: { id?: string; company_id?: string; scan_id?: string; competitor_name?: string; competitor_domain?: string | null; source_url?: string; source_domain?: string; source_title?: string; source_snippet?: string; published_at?: string | null; observed_at?: string; content_hash?: string; created_at?: string; competitor_id?: string | null; evidence_kind?: string; source_record_key?: string; source_date_text?: string | null; provider_search_id?: string | null; attributes?: Json }
        Relationships: []
      }
      brand_competitor_products: {
        Row: { id: string; company_id: string; campaign_id: string; competitor_id: string; scan_id: string; asin: string; amazon_domain: string; title: string; source_url: string; rating: number | null; review_count: number | null; price: number | null; price_text: string | null; currency: string | null; status: string; observed_at: string; provider_search_id: string | null }
        Insert: { id?: string; company_id: string; campaign_id: string; competitor_id: string; scan_id: string; asin: string; amazon_domain?: string; title: string; source_url: string; rating?: number | null; review_count?: number | null; price?: number | null; price_text?: string | null; currency?: string | null; status?: string; observed_at: string; provider_search_id?: string | null }
        Update: { id?: string; company_id?: string; campaign_id?: string; competitor_id?: string; scan_id?: string; asin?: string; amazon_domain?: string; title?: string; source_url?: string; rating?: number | null; review_count?: number | null; price?: number | null; price_text?: string | null; currency?: string | null; status?: string; observed_at?: string; provider_search_id?: string | null }
        Relationships: []
      }
      brand_competitor_scans: {
        Row: { id: string; company_id: string; campaign_id: string; provider_key: string; query_hash: string; market: string; status: string; result_count: number; error_code: string | null; started_at: string | null; completed_at: string | null; created_by: string; created_at: string }
        Insert: { id?: string; company_id: string; campaign_id: string; provider_key?: string; query_hash: string; market?: string; status?: string; result_count?: number; error_code?: string | null; started_at?: string | null; completed_at?: string | null; created_by: string; created_at?: string }
        Update: { id?: string; company_id?: string; campaign_id?: string; provider_key?: string; query_hash?: string; market?: string; status?: string; result_count?: number; error_code?: string | null; started_at?: string | null; completed_at?: string | null; created_by?: string; created_at?: string }
        Relationships: []
      }
      brand_competitors: {
        Row: { id: string; company_id: string; campaign_id: string; scan_id: string; name: string; official_domain: string; rationale: string; status: string; evidence_ids: string[]; verified_at: string; confirmed_at: string | null; enrichment_status: string; enrichment_started_at: string | null; enriched_at: string | null; error_code: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; company_id: string; campaign_id: string; scan_id: string; name: string; official_domain: string; rationale: string; status?: string; evidence_ids?: string[]; verified_at: string; confirmed_at?: string | null; enrichment_status?: string; enrichment_started_at?: string | null; enriched_at?: string | null; error_code?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; company_id?: string; campaign_id?: string; scan_id?: string; name?: string; official_domain?: string; rationale?: string; status?: string; evidence_ids?: string[]; verified_at?: string; confirmed_at?: string | null; enrichment_status?: string; enrichment_started_at?: string | null; enriched_at?: string | null; error_code?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      brand_creator_catalog: {
        Row: { id: string; creator_id: string; display_name: string; bio: string; city: string | null; categories: string[]; languages: string[]; profile_url: string | null; active: boolean; directory_consented_at: string | null; published_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; creator_id: string; display_name: string; bio?: string; city?: string | null; categories?: string[]; languages?: string[]; profile_url?: string | null; active?: boolean; directory_consented_at?: string | null; published_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; creator_id?: string; display_name?: string; bio?: string; city?: string | null; categories?: string[]; languages?: string[]; profile_url?: string | null; active?: boolean; directory_consented_at?: string | null; published_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      brand_creator_rates: {
        Row: { id: string; catalog_id: string; deliverable_type: string; unit_rate_cents: number; currency: string; active: boolean; updated_at: string }
        Insert: { id?: string; catalog_id: string; deliverable_type: string; unit_rate_cents: number; currency?: string; active?: boolean; updated_at?: string }
        Update: { id?: string; catalog_id?: string; deliverable_type?: string; unit_rate_cents?: number; currency?: string; active?: boolean; updated_at?: string }
        Relationships: []
      }
      brand_memberships: {
        Row: { company_id: string; user_id: string; role: string; status: string; created_at: string; updated_at: string }
        Insert: { company_id: string; user_id: string; role?: string; status?: string; created_at?: string; updated_at?: string }
        Update: { company_id?: string; user_id?: string; role?: string; status?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      brand_preview_job_private: {
        Row: { job_id: string; idempotency_key: string; request_payload: Json; status_url: string | null; output_url: string | null }
        Insert: { job_id: string; idempotency_key?: string; request_payload: Json; status_url?: string | null; output_url?: string | null }
        Update: { job_id?: string; idempotency_key?: string; request_payload?: Json; status_url?: string | null; output_url?: string | null }
        Relationships: []
      }
      brand_preview_jobs: {
        Row: { id: string; request_id: string; company_id: string; campaign_id: string; model: string; kind: string; status: string; estimated_cost_usd: number; estimated_credits: number; quote_expires_at: string; provider_request_id: string | null; failure_code: string | null; media_object_key: string | null; media_content_type: string | null; last_polled_at: string | null; submitted_at: string | null; completed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; request_id: string; company_id: string; campaign_id: string; model: string; kind: string; status: string; estimated_cost_usd: number; estimated_credits: number; quote_expires_at: string; provider_request_id?: string | null; failure_code?: string | null; media_object_key?: string | null; media_content_type?: string | null; last_polled_at?: string | null; submitted_at?: string | null; completed_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; request_id?: string; company_id?: string; campaign_id?: string; model?: string; kind?: string; status?: string; estimated_cost_usd?: number; estimated_credits?: number; quote_expires_at?: string; provider_request_id?: string | null; failure_code?: string | null; media_object_key?: string | null; media_content_type?: string | null; last_polled_at?: string | null; submitted_at?: string | null; completed_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      brand_preview_requests: {
        Row: { id: string; company_id: string; campaign_id: string; creative_id: string; creative_revision: number; creator_id: string | null; kind: string; campaign_title: string; brand_name: string; prompt: string; request_hash: string; status: string; reference_object_key: string | null; reference_sha256: string | null; consented_at: string | null; consented_by: string | null; consent_version: string | null; expires_at: string; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; company_id: string; campaign_id: string; creative_id: string; creative_revision: number; creator_id?: string | null; kind: string; campaign_title: string; brand_name: string; prompt: string; request_hash: string; status: string; reference_object_key?: string | null; reference_sha256?: string | null; consented_at?: string | null; consented_by?: string | null; consent_version?: string | null; expires_at: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; company_id?: string; campaign_id?: string; creative_id?: string; creative_revision?: number; creator_id?: string | null; kind?: string; campaign_title?: string; brand_name?: string; prompt?: string; request_hash?: string; status?: string; reference_object_key?: string | null; reference_sha256?: string | null; consented_at?: string | null; consented_by?: string | null; consent_version?: string | null; expires_at?: string; created_by?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      brand_search_cache: {
        Row: { company_id: string; cache_key: string; engine: string; payload: Json; provider_search_id: string | null; fetched_at: string; expires_at: string }
        Insert: { company_id: string; cache_key: string; engine: string; payload: Json; provider_search_id?: string | null; fetched_at?: string; expires_at: string }
        Update: { company_id?: string; cache_key?: string; engine?: string; payload?: Json; provider_search_id?: string | null; fetched_at?: string; expires_at?: string }
        Relationships: []
      }
      external_api_bills: {
        Row: { id: string; provider_key: string; invoice_reference: string; amount_usd: number; currency: string; billed_at: string; period_start: string; period_end: string; recorded_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; provider_key: string; invoice_reference: string; amount_usd: number; currency?: string; billed_at: string; period_start: string; period_end: string; recorded_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; provider_key?: string; invoice_reference?: string; amount_usd?: number; currency?: string; billed_at?: string; period_start?: string; period_end?: string; recorded_by?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      external_api_usage_events: {
        Row: { id: string; company_id: string | null; campaign_id: string | null; actor_user_id: string | null; provider_key: string; operation: string; model: string | null; status: string; latency_ms: number | null; retry_count: number; cache_hit: boolean; input_units: number | null; output_units: number | null; unit_type: string | null; estimated_cost_usd: number | null; billed_cost_usd: number | null; billed_cost_verified: boolean; failure_code: string | null; created_at: string; provider_request_id: string | null; billing_reference: string | null; reconciled_at: string | null; idempotency_key: string | null; completed_at: string | null; reserved_cost_usd: number | null }
        Insert: { id?: string; company_id?: string | null; campaign_id?: string | null; actor_user_id?: string | null; provider_key: string; operation: string; model?: string | null; status: string; latency_ms?: number | null; retry_count?: number; cache_hit?: boolean; input_units?: number | null; output_units?: number | null; unit_type?: string | null; estimated_cost_usd?: number | null; billed_cost_usd?: number | null; billed_cost_verified?: boolean; failure_code?: string | null; created_at?: string; provider_request_id?: string | null; billing_reference?: string | null; reconciled_at?: string | null; idempotency_key?: string | null; completed_at?: string | null; reserved_cost_usd?: number | null }
        Update: { id?: string; company_id?: string | null; campaign_id?: string | null; actor_user_id?: string | null; provider_key?: string; operation?: string; model?: string | null; status?: string; latency_ms?: number | null; retry_count?: number; cache_hit?: boolean; input_units?: number | null; output_units?: number | null; unit_type?: string | null; estimated_cost_usd?: number | null; billed_cost_usd?: number | null; billed_cost_verified?: boolean; failure_code?: string | null; created_at?: string; provider_request_id?: string | null; billing_reference?: string | null; reconciled_at?: string | null; idempotency_key?: string | null; completed_at?: string | null; reserved_cost_usd?: number | null }
        Relationships: []
      }
      admin_user_preferences: {
        Row: {
          admin_onboarding_completed: boolean
          company_id: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_onboarding_completed?: boolean
          company_id: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_onboarding_completed?: boolean
          company_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          company_id: string
          created_at: string
          duration_minutes: number | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_reversible: boolean
          metadata: Json
          status: Database["public"]["Enums"]["audit_event_status"]
          undo_action_key: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          company_id: string
          created_at?: string
          duration_minutes?: number | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_reversible?: boolean
          metadata?: Json
          status?: Database["public"]["Enums"]["audit_event_status"]
          undo_action_key?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          company_id?: string
          created_at?: string
          duration_minutes?: number | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_reversible?: boolean
          metadata?: Json
          status?: Database["public"]["Enums"]["audit_event_status"]
          undo_action_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_brand_settings: {
        Row: {
          company_id: string
          dark_colors: Json
          dark_logo_key: string | null
          dark_logo_meta: Json | null
          default_theme: string
          favicon_key: string | null
          favicon_meta: Json | null
          gradient: Json
          light_colors: Json
          light_logo_key: string | null
          light_logo_meta: Json | null
          primary_logo_key: string | null
          primary_logo_meta: Json | null
          radius: Json
          spacing: number[]
          typography: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          dark_colors: Json
          dark_logo_key?: string | null
          dark_logo_meta?: Json | null
          default_theme?: string
          favicon_key?: string | null
          favicon_meta?: Json | null
          gradient: Json
          light_colors: Json
          light_logo_key?: string | null
          light_logo_meta?: Json | null
          primary_logo_key?: string | null
          primary_logo_meta?: Json | null
          radius?: Json
          spacing?: number[]
          typography: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          dark_colors?: Json
          dark_logo_key?: string | null
          dark_logo_meta?: Json | null
          default_theme?: string
          favicon_key?: string | null
          favicon_meta?: Json | null
          gradient?: Json
          light_colors?: Json
          light_logo_key?: string | null
          light_logo_meta?: Json | null
          primary_logo_key?: string | null
          primary_logo_meta?: Json | null
          radius?: Json
          spacing?: number[]
          typography?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_brand_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_configuration: {
        Row: {
          category: string
          company_id: string
          description: string | null
          id: string
          is_tbd: boolean
          key: string
          label: string
          updated_at: string
          value: Json | null
          value_type: Database["public"]["Enums"]["configuration_value_type"]
        }
        Insert: {
          category: string
          company_id: string
          description?: string | null
          id?: string
          is_tbd?: boolean
          key: string
          label: string
          updated_at?: string
          value?: Json | null
          value_type: Database["public"]["Enums"]["configuration_value_type"]
        }
        Update: {
          category?: string
          company_id?: string
          description?: string | null
          id?: string
          is_tbd?: boolean
          key?: string
          label?: string
          updated_at?: string
          value?: Json | null
          value_type?: Database["public"]["Enums"]["configuration_value_type"]
        }
        Relationships: [
          {
            foreignKeyName: "company_configuration_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_creators: {
        Row: {
          commercial_relationship: string | null
          company_id: string
          created_at: string
          creator_id: string
          id: string
          metadata: Json
          source: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          commercial_relationship?: string | null
          company_id: string
          created_at?: string
          creator_id: string
          id?: string
          metadata?: Json
          source?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          commercial_relationship?: string | null
          company_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          metadata?: Json
          source?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_creators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      company_integrations: {
        Row: {
          category: string
          company_id: string
          id: string
          label: string
          non_secret_config: Json
          provider_key: string
          state: Database["public"]["Enums"]["integration_state"]
          status_message: string | null
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          id?: string
          label: string
          non_secret_config?: Json
          provider_key: string
          state?: Database["public"]["Enums"]["integration_state"]
          status_message?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          id?: string
          label?: string
          non_secret_config?: Json
          provider_key?: string
          state?: Database["public"]["Enums"]["integration_state"]
          status_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["template_channel"]
          company_id: string
          id: string
          is_active: boolean
          label: string
          requires_human_review: boolean
          subject: string | null
          template_key: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body?: string
          channel: Database["public"]["Enums"]["template_channel"]
          company_id: string
          id?: string
          is_active?: boolean
          label: string
          requires_human_review?: boolean
          subject?: string | null
          template_key: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["template_channel"]
          company_id?: string
          id?: string
          is_active?: boolean
          label?: string
          requires_human_review?: boolean
          subject?: string | null
          template_key?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_accounts: {
        Row: {
          company_id: string
          created_at: string
          creator_id: string
          entitlement_state: Json
          onboarding_completed: boolean
          onboarding_data: Json
          onboarding_step: number
          phone: string | null
          preferences: Json
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          creator_id: string
          entitlement_state?: Json
          onboarding_completed?: boolean
          onboarding_data?: Json
          onboarding_step?: number
          phone?: string | null
          preferences?: Json
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          creator_id?: string
          entitlement_state?: Json
          onboarding_completed?: boolean
          onboarding_data?: Json
          onboarding_step?: number
          phone?: string | null
          preferences?: Json
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_cms_content: {
        Row: {
          company_id: string
          content_key: string
          is_active: boolean
          label: string
          section: string
          updated_at: string
          value: string
        }
        Insert: {
          company_id: string
          content_key: string
          is_active?: boolean
          label: string
          section: string
          updated_at?: string
          value?: string
        }
        Update: {
          company_id?: string
          content_key?: string
          is_active?: boolean
          label?: string
          section?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_cms_content_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_create_usage: {
        Row: {
          captions_used: number
          creator_id: string
          hashtags_used: number
          id: string
          month_start: string
          updated_at: string
        }
        Insert: {
          captions_used?: number
          creator_id: string
          hashtags_used?: number
          id?: string
          month_start: string
          updated_at?: string
        }
        Update: {
          captions_used?: number
          creator_id?: string
          hashtags_used?: number
          id?: string
          month_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_create_usage_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_social_accounts: {
        Row: {
          created_at: string
          creator_id: string
          handle: string | null
          id: string
          is_primary: boolean
          metadata: Json
          platform: string | null
          profile_url: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          handle?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          platform?: string | null
          profile_url: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          handle?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          platform?: string | null
          profile_url?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_social_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_studio_profiles: {
        Row: {
          consent_scope: string | null
          consented_at: string | null
          creator_id: string
          model_status: string
          photos_captured: number
          setup_status: string
          updated_at: string
          voice_captured: boolean
        }
        Insert: {
          consent_scope?: string | null
          consented_at?: string | null
          creator_id: string
          model_status?: string
          photos_captured?: number
          setup_status?: string
          updated_at?: string
          voice_captured?: boolean
        }
        Update: {
          consent_scope?: string | null
          consented_at?: string | null
          creator_id?: string
          model_status?: string
          photos_captured?: number
          setup_status?: string
          updated_at?: string
          voice_captured?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "creator_studio_profiles_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          metadata: Json
          primary_handle: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          metadata?: Json
          primary_handle?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          metadata?: Json
          primary_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Update: {
          permission?: string
          role?: Database["public"]["Enums"]["team_role"]
        }
        Relationships: []
      }
      team_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["team_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      storyloop_public_brand_assets: {
        Row: { dark_logo_key: string | null; light_logo_key: string | null; primary_logo_key: string | null }
        Relationships: []
      }
    }
    Functions: {
      begin_provider_operation: { Args: { target_company_id: string; target_campaign_id: string; actor_id: string; provider: string; operation_name: string; model_name: string | null; dedupe_key: string; reserved_cost: number | null }; Returns: Json }
      finish_provider_operation: { Args: { event_id: string; outcome: Json }; Returns: undefined }
      save_brand_campaign_brief: { Args: { target_campaign_id: string; expected_revision: number; updated_brief: Json; approve?: boolean; source_model?: string | null }; Returns: number }
      set_brand_creator_selection: { Args: { target_campaign_id: string; target_rate_id: string; target_quantity: number; expected_rate_cents?: number | null }; Returns: string }
      get_brand_campaign_benchmarks: { Args: { target_campaign_id: string }; Returns: { deliverable_type: string; campaign_count: number; median_unit_rate_cents: number; p25_unit_rate_cents: number; p75_unit_rate_cents: number }[] }
      transition_brand_campaign: { Args: { target_campaign_id: string; target_status: string; event_at: string }; Returns: undefined }
      save_brand_creative: { Args: { p_creative_id: string; p_revision: number; p_content: Json }; Returns: undefined }
      approve_brand_creative: { Args: { p_creative_id: string; p_revision: number }; Returns: undefined }
      create_brand_workspace: { Args: { workspace_name: string }; Returns: string }
      consume_serpapi_scan_quota: { Args: { target_company_id: string }; Returns: boolean }
      consume_openai_brief_quota: { Args: { target_campaign_id: string; target_company_id: string }; Returns: boolean }
      complete_creator_onboarding: { Args: never; Returns: string }
      ensure_creator_account: {
        Args: { p_phone?: string; p_source?: string }
        Returns: string
      }
      get_creator_configuration: {
        Args: never
        Returns: {
          is_tbd: boolean
          key: string
          label: string
          value: Json
        }[]
      }
    }
    Enums: {
      audit_event_status: "success" | "failed"
      configuration_value_type: "boolean" | "integer" | "number" | "string"
      integration_state: "disconnected" | "mock" | "sandbox" | "live" | "error"
      team_role: "junior" | "senior"
      template_channel: "whatsapp" | "email" | "system" | "document"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_event_status: ["success", "failed"],
      configuration_value_type: ["boolean", "integer", "number", "string"],
      integration_state: ["disconnected", "mock", "sandbox", "live", "error"],
      team_role: ["junior", "senior"],
      template_channel: ["whatsapp", "email", "system", "document"],
    },
  },
} as const
