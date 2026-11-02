const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users','goals','daily_reports','notifications','meal_records','report_documents','notification_email_deliveries') ORDER BY tablename`;
  const columns = await prisma.$queryRaw`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'goals' AND column_name IN ('cadence','periodStart','completedAt') ORDER BY column_name`;
  const indexes = await prisma.$queryRaw`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'meal_records'`;
  console.log(JSON.stringify({ tables, objectiveColumns: columns, mealIndexes: indexes }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
