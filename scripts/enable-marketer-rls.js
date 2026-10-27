const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30",
  });
  await client.connect();
  await client.query(`ALTER TABLE "public"."marketer_leads" ENABLE ROW LEVEL SECURITY;`);
  await client.query(`ALTER TABLE "public"."marketer_territories" ENABLE ROW LEVEL SECURITY;`);
  console.log('✅ RLS successfully enabled on marketer_leads and marketer_territories');
  await client.end();
}

run().catch(console.error);
