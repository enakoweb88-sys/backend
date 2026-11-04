import { Prisma } from '@prisma/client';

// A management role does not grant access to another person's private work.
export const taskAccess = (userId: string): Prisma.TaskWhereInput => ({
  OR: [{ assigneeId: userId }, { creatorId: userId }],
});
export const personalGoalAccess = (userId: string): Prisma.GoalWhereInput => ({
  OR: [{ ownerId: userId }, { creatorId: userId }],
});
