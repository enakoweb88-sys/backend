const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30",
  });

  const categories = {
    publicRead: [
      "outreach_events", "blog_posts", "public_impact_stats", "public_impact_charts", 
      "public_milestones", "community_projects", "content_posts", "ad_campaigns", "social_metrics"
    ],
    publicInsert: [
      "outreach_applications", "newsletter_subscribers", "Donation", "support_tickets", 
      "support_ticket_replies", "leads", "cookie_consent_records", "web_analytics_events"
    ],
    authenticated: [
      "user_preferences", "user_sessions", "channel_members"
    ],
    private: [
      "bank_accounts", "budgets", "invoices", "commissions", "leave_requests", "njangi_contributions", 
      "njangi_groups", "float_accounts", "marketing_channels", "investments", "daily_reports", 
      "subscriptions", "meetings", "channels", "app_activities", "_DepartmentLeaders", "report_files", 
      "announcement_likes", "announcement_comments"
    ]
  };

  try {
    await client.connect();
    console.log("Applying secure RLS policies...");

    for (const table of categories.publicRead) {
      await client.query(`DROP POLICY IF EXISTS "allow_all_public" ON "public"."${table}";`);
      await client.query(`DROP POLICY IF EXISTS "public_read" ON "public"."${table}";`);
      await client.query(`CREATE POLICY "public_read" ON "public"."${table}" FOR SELECT USING (true);`);
      console.log(`Applied Public Read-Only to ${table}`);
    }

    for (const table of categories.publicInsert) {
      await client.query(`DROP POLICY IF EXISTS "allow_all_public" ON "public"."${table}";`);
      await client.query(`DROP POLICY IF EXISTS "public_insert" ON "public"."${table}";`);
      await client.query(`CREATE POLICY "public_insert" ON "public"."${table}" FOR INSERT WITH CHECK (true);`);
      console.log(`Applied Public Insert-Only to ${table}`);
    }

    for (const table of categories.authenticated) {
      await client.query(`DROP POLICY IF EXISTS "allow_all_public" ON "public"."${table}";`);
      await client.query(`DROP POLICY IF EXISTS "auth_all" ON "public"."${table}";`);
      try {
        await client.query(`CREATE POLICY "auth_all" ON "public"."${table}" USING (auth.uid()::text = "userId"::text);`);
        console.log(`Applied Authenticated access to ${table}`);
      } catch (e) {
        console.log(`Fallback for ${table} (no userId column), setting to private.`);
        await client.query(`CREATE POLICY "auth_all" ON "public"."${table}" USING (false);`);
      }
    }

    for (const table of categories.private) {
      await client.query(`DROP POLICY IF EXISTS "allow_all_public" ON "public"."${table}";`);
      await client.query(`DROP POLICY IF EXISTS "deny_all" ON "public"."${table}";`);
      await client.query(`CREATE POLICY "deny_all" ON "public"."${table}" USING (false);`);
      console.log(`Applied Private (Deny All) to ${table}`);
    }

    console.log("All RLS policies successfully applied.");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
