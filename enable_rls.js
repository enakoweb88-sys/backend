const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30",
  });

  try {
    await client.connect();
    const tables = [
      "meetings", "content_posts", "ad_campaigns", "social_metrics", 
      "leave_requests", "njangi_contributions", "commissions", "_DepartmentLeaders",
      "channels", "channel_members", "newsletter_subscribers", "support_tickets",
      "Donation", "support_ticket_replies", "public_impact_charts", "user_preferences",
      "report_files", "public_milestones", "public_impact_stats", "bank_accounts",
      "budgets", "invoices", "app_activities", "marketing_channels", "leads",
      "njangi_groups", "float_accounts", "outreach_applications", "user_sessions",
      "blog_posts", "outreach_events", "announcement_likes", "announcement_comments",
      "investments", "cookie_consent_records", "web_analytics_events", "community_projects",
      "daily_reports", "subscriptions"
    ];

    console.log("Enabling RLS on tables...");
    for (const table of tables) {
      try {
        await client.query(`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY;`);
        console.log(`Successfully enabled RLS for "public"."${table}"`);
      } catch (e) {
        console.error(`Failed for "public"."${table}": ${e.message}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
