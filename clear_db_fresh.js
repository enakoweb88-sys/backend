const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Database Fresh Clean (Preserving User Accounts & Roles)...');

    // Delete child records first to respect FK constraints
    console.log('Clearing task comments...');
    await prisma.taskComment.deleteMany();

    console.log('Clearing tasks...');
    await prisma.task.deleteMany();

    console.log('Clearing expenses...');
    await prisma.expense.deleteMany();

    console.log('Clearing transactions...');
    await prisma.transaction.deleteMany();

    console.log('Clearing meal records...');
    await prisma.mealRecord.deleteMany();

    console.log('Clearing daily reports...');
    await prisma.dailyReport.deleteMany();

    console.log('Clearing KYC documents & submissions...');
    await prisma.kycDocument.deleteMany();
    await prisma.kycSubmission.deleteMany();

    console.log('Clearing goals...');
    await prisma.goal.deleteMany();

    console.log('Clearing channel members & channels...');
    await prisma.channelMember.deleteMany();
    await prisma.channel.deleteMany();

    console.log('Clearing announcement comments, likes & announcements...');
    await prisma.announcementComment.deleteMany();
    await prisma.announcementLike.deleteMany();
    await prisma.announcement.deleteMany();

    console.log('Clearing notifications & messages...');
    await prisma.notification.deleteMany();
    await prisma.message.deleteMany();

    console.log('Clearing performance metrics & documents...');
    await prisma.performanceMetric.deleteMany();
    await prisma.document.deleteMany();

    console.log('Clearing audit logs & activity logs...');
    await prisma.auditLog.deleteMany();
    await prisma.activityLog.deleteMany();

    console.log('Clearing finance & banking records...');
    await prisma.bankAccount.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.commission.deleteMany();
    await prisma.floatAccount.deleteMany();
    await prisma.investment.deleteMany();

    console.log('Clearing marketing & CRM data...');
    await prisma.lead.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.appActivity.deleteMany();
    await prisma.marketingChannel.deleteMany();
    await prisma.contentPost.deleteMany();
    await prisma.adCampaign.deleteMany();
    await prisma.socialMetric.deleteMany();

    console.log('Clearing support tickets & replies...');
    await prisma.supportTicketReply.deleteMany();
    await prisma.supportTicket.deleteMany();

    console.log('Clearing Njangi & leave requests...');
    await prisma.njangiContribution.deleteMany();
    await prisma.njangiGroup.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.reportFile.deleteMany();

    console.log('Clearing outreach events, applications & donations...');
    await prisma.outreachApplication.deleteMany();
    await prisma.outreachEvent.deleteMany();
    await prisma.blogPost.deleteMany();
    await prisma.newsletterSubscriber.deleteMany();
    await prisma.donation.deleteMany();
    await prisma.communityProject.deleteMany();

    console.log('Clearing web analytics & cookie consents...');
    await prisma.cookieConsentRecord.deleteMany();
    await prisma.webAnalyticsEvent.deleteMany();

    console.log('Clearing active user sessions & refresh tokens...');
    await prisma.userSession.deleteMany();
    await prisma.refreshToken.deleteMany();

    const remainingUsers = await prisma.user.findMany({
        select: { email: true, fullName: true, role: { select: { name: true } } }
    });

    console.log('\n✅ DATABASE CLEARED SUCCESSFULLY!');
    console.log(`🔒 Preserved User Accounts (${remainingUsers.length}):`);
    remainingUsers.forEach(u => console.log(` - ${u.fullName} (${u.email}) [${u.role.name}]`));

    await prisma.$disconnect();
}

main().catch(err => {
    console.error('❌ Error clearing database:', err);
    prisma.$disconnect();
    process.exit(1);
});
