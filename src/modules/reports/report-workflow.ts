import { Prisma } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';

export function reportInboxAccess(user: JwtUser): Prisma.DailyReportWhereInput {
  if (user.role === 'CEO')
    return {
      OR: [
        { userId: user.sub },
        { status: 'VERIFIED' },
        // Managers submit their own reports directly to the CEO; they cannot self-approve.
        {
          user: { role: { name: { in: ['MANAGER', 'OUTREACH_MANAGER'] } } },
          status: { in: ['SUBMITTED', 'RETURNED'] },
        },
      ],
    };
  if (['MANAGER', 'OUTREACH_MANAGER'].includes(user.role))
    return {
      OR: [{ userId: user.sub }, { status: { in: ['SUBMITTED', 'VERIFIED', 'RETURNED'] } }],
    };
  return { userId: user.sub };
}

export function submissionReviewerRoles(authorRole: string): ('CEO' | 'MANAGER')[] {
  if (authorRole === 'CEO') return [];
  return ['MANAGER', 'OUTREACH_MANAGER'].includes(authorRole) ? ['CEO'] : ['MANAGER'];
}

export function canReviewWorkReport(
  user: JwtUser,
  report: { userId: string; user?: { role?: { name?: string } | null } },
) {
  if (report.userId === user.sub) return false;
  if (user.role === 'CEO')
    return ['MANAGER', 'OUTREACH_MANAGER'].includes(report.user?.role?.name || '');
  return ['MANAGER', 'OUTREACH_MANAGER'].includes(user.role);
}
