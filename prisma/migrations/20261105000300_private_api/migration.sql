-- Backend owns authorization. Supabase anonymous/authenticated clients have no
-- direct table access. Review all tables and baseline before any existing DB migration.
-- A separate DBA provisions enako_runtime (LOGIN, NOSUPERUSER, NOBYPASSRLS,
-- NOCREATEDB, NOCREATEROLE). This migration does not create credentials.
DO $$ DECLARE relation_name text; browser_role text; BEGIN
  FOREACH relation_name IN ARRAY ARRAY['_DepartmentLeaders','Donation','roles','departments','users','user_preferences','user_sessions','cash_clients','refresh_tokens','tasks','task_comments','expenses','transactions','meal_records','daily_reports','report_documents','kyc_submissions','kyc_documents','goals','channels','channel_members','announcements','announcement_likes','announcement_comments','notifications','notification_email_deliveries','messages','performance_metrics','documents','audit_logs','activity_logs','bank_accounts','budgets','invoices','app_activities','marketing_channels','njangi_groups','njangi_contributions','leads','meetings','commissions','content_posts','ad_campaigns','social_metrics','support_tickets','support_ticket_replies','leave_requests','subscriptions','report_files','outreach_events','blog_posts','outreach_applications','newsletter_subscribers','public_impact_stats','public_milestones','public_impact_charts','float_accounts','exchange_rates','investments','cookie_consent_records','web_analytics_events','community_projects','cash_collections','marketer_leads','marketer_territories','auth_sessions','rate_limit_buckets','secure_files','cash_users','cash_sessions','cash_audit_logs','cash_transactions','cash_float_accounts','cash_exchange_rates','cash_documents','cash_kyc_submissions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', relation_name);
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', relation_name, browser_role); END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'enako_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO enako_runtime', relation_name);
      EXECUTE format('CREATE POLICY enako_backend_access ON public.%I FOR ALL TO enako_runtime USING (true) WITH CHECK (true)', relation_name);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'enako_runtime') THEN
    GRANT USAGE ON SCHEMA public TO enako_runtime;
    REVOKE CREATE ON SCHEMA public FROM enako_runtime;
  END IF;
END $$;
