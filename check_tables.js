const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: require('./scripts/maintenance-config.cjs').databaseUrl(),
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in public schema:");
    res.rows.forEach(r => console.log(`- ${r.table_name}`));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
