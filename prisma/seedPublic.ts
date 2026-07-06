import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Public Impact Data via createMany...');

  await prisma.publicImpactStat.deleteMany({});
  const stats = [
    { key: 'lives_targeted', value: '120+', label: 'Lives Targeted', section: 'hero', order: 1 },
    { key: 'communities', value: '8', label: 'Communities', section: 'hero', order: 2 },
    { key: 'phase', value: 'Pilot', label: 'Phase', section: 'hero', order: 3 },
    { key: 'kpi_students', value: '120+', label: 'Students Targeted', section: 'kpi', order: 1 },
    { key: 'kpi_schools', value: '8', label: 'Schools Targeted', section: 'kpi', order: 2 },
    { key: 'kpi_teachers', value: '6', label: 'Teachers Recognized', section: 'kpi', order: 3 },
    { key: 'kpi_communities', value: '8', label: 'Communities Helped', section: 'kpi', order: 4 },
    { key: 'dash_schools', value: '5', label: 'Partner Schools', section: 'dashboard', order: 1 },
    { key: 'dash_students', value: '120+', label: 'Target Students', section: 'dashboard', order: 2 },
    { key: 'dash_planned', value: '8', label: 'Schools planned', section: 'dashboard', order: 3 },
    { key: 'dash_regions', value: '2', label: 'Regions Covered', section: 'dashboard', order: 4 },
  ];
  await prisma.publicImpactStat.createMany({ data: stats });

  // Milestones
  await prisma.publicMilestone.deleteMany({});
  const milestones = [
    { year: 'Phase 1', title: 'Douala Launch', description: 'Enako Outreach establishes headquarters in Douala with 5 partner schools.', order: 1 },
    { year: 'Phase 2', title: 'First Charity Mission', description: 'Launching our inaugural charity mission to provide immediate educational support.', order: 2 },
    { year: 'Phase 3', title: 'Regional Expansion', description: 'Expanding coverage to 8 partner schools across target communities.', order: 3 },
  ];
  await prisma.publicMilestone.createMany({ data: milestones });

  // Charts
  await prisma.publicImpactChart.deleteMany({});
  const charts = [
    { label: 'Scholarships', percentage: 40, color: 'bg-[#00BFA5]', order: 1 },
    { label: 'Teacher Awards', percentage: 25, color: 'bg-[#00BFA5]', order: 2 },
    { label: 'Community Dev', percentage: 22, color: 'bg-[#00BFA5]', order: 3 },
    { label: 'Orphanage Support', percentage: 13, color: 'bg-[#00BFA5]', order: 4 },
  ];
  await prisma.publicImpactChart.createMany({ data: charts });

  console.log('Done seeding public data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
