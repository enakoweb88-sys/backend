import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const programStats = [
  // Scholarships
  { section: 'program_scholarships', key: 'students_funded', label: 'Students Funded', value: '8', order: 1 },
  { section: 'program_scholarships', key: 'graduation_rate', label: 'Graduation Rate', value: '92%', order: 2 },
  { section: 'program_scholarships', key: 'partner_schools', label: 'Partner Schools', value: '4', order: 3 },
  
  // Scholarships Primary
  { section: 'program_scholarships-primary', key: 'children_supported', label: 'Children Supported', value: '6', order: 1 },
  { section: 'program_scholarships-primary', key: 'schools_covered', label: 'Schools Covered', value: '3', order: 2 },
  { section: 'program_scholarships-primary', key: 'regions', label: 'Regions', value: '5', order: 3 },
  
  // Scholarships Secondary
  { section: 'program_scholarships-secondary', key: 'students_funded_sec', label: 'Students Funded', value: '5', order: 1 },
  { section: 'program_scholarships-secondary', key: 'exam_readiness', label: 'Exam Readiness', value: '88%', order: 2 },
  { section: 'program_scholarships-secondary', key: 'boarding_grants', label: 'Boarding Grants', value: '2', order: 3 },
  
  // Scholarships University
  { section: 'program_scholarships-university', key: 'university_grants', label: 'University Grants', value: '3', order: 1 },
  { section: 'program_scholarships-university', key: 'academic_standing', label: 'Academic Standing', value: 'Good', order: 2 },
  { section: 'program_scholarships-university', key: 'mentorship_matches', label: 'Mentorship Matches', value: '3', order: 3 },
  
  // Clean Water Initiative
  { section: 'program_clean-water-initiative', key: 'boreholes_drilled', label: 'Boreholes Drilled', value: '18', order: 1 },
  { section: 'program_clean-water-initiative', key: 'beneficiaries', label: 'Beneficiaries', value: '28k+', order: 2 },
  { section: 'program_clean-water-initiative', key: 'communities', label: 'Communities', value: '22', order: 3 },
  { section: 'program_clean-water-initiative', key: 'regions_cw', label: 'Regions', value: '3', order: 4 },
  
  // Teacher Rewards
  { section: 'program_teacher-rewards', key: 'teachers_awarded', label: 'Teachers Awarded', value: '6', order: 1 },
  { section: 'program_teacher-rewards', key: 'regions_tr', label: 'Regions Covered', value: '2', order: 2 },
  { section: 'program_teacher-rewards', key: 'training_sessions', label: 'Training Sessions', value: '4', order: 3 },
  { section: 'program_teacher-rewards', key: 'cohort_status', label: 'Cohort', value: 'Pilot', order: 4 },
  
  // Community Health Support
  { section: 'program_community-health-support', key: 'patients_served', label: 'Patients Served', value: '42k+', order: 1 },
  { section: 'program_community-health-support', key: 'mobile_clinics', label: 'Mobile Clinics', value: '6', order: 2 },
  { section: 'program_community-health-support', key: 'health_workers_trained', label: 'Health Workers Trained', value: '85', order: 3 },
  { section: 'program_community-health-support', key: 'regions_ch', label: 'Regions', value: '5', order: 4 },
  
  // Single Mothers Assistance
  { section: 'program_single-mothers-assistance', key: 'women_enrolled', label: 'Women Enrolled', value: '10', order: 1 },
  { section: 'program_single-mothers-assistance', key: 'businesses_started', label: 'Businesses Started', value: '4', order: 2 },
  { section: 'program_single-mothers-assistance', key: 'active_graduates', label: 'Active Graduates', value: '7', order: 3 },
  { section: 'program_single-mothers-assistance', key: 'regions_sm', label: 'Regions', value: '2', order: 4 },
  
  // Youth Empowerment
  { section: 'program_youth-empowerment', key: 'youth_trained', label: 'Youth Trained', value: '12', order: 1 },
  { section: 'program_youth-empowerment', key: 'businesses_funded', label: 'Businesses Funded', value: '3', order: 2 },
  { section: 'program_youth-empowerment', key: 'placement_progress', label: 'Placement Progress', value: 'Ongoing', order: 3 },
  { section: 'program_youth-empowerment', key: 'regions_ye', label: 'Regions', value: '2', order: 4 }
];

async function main() {
  console.log('Starting seed...');
  for (const stat of programStats) {
    const uniqueKey = `${stat.section}_${stat.key}`;
    const statData = { ...stat, key: uniqueKey };
    
    const existing = await prisma.publicImpactStat.findFirst({
      where: { key: uniqueKey }
    });
    
    if (!existing) {
      await prisma.publicImpactStat.create({
        data: statData
      });
      console.log(`Created stat ${uniqueKey} for ${stat.section}`);
    } else {
      console.log(`Stat ${uniqueKey} for ${stat.section} already exists. Updating...`);
      await prisma.publicImpactStat.update({
        where: { id: existing.id },
        data: statData
      });
    }
  }
  console.log('Seed completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
