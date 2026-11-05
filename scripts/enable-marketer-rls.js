const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: require('./maintenance-config.cjs').databaseUrl(),
  });
  await client.connect();
  await client.query(`ALTER TABLE "public"."marketer_leads" ENABLE ROW LEVEL SECURITY;`);
  await client.query(`ALTER TABLE "public"."marketer_territories" ENABLE ROW LEVEL SECURITY;`);
  console.log('✅ RLS successfully enabled on marketer_leads and marketer_territories');
  await client.end();
}

run().catch(console.error);
