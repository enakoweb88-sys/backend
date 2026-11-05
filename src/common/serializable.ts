import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../modules/prisma/prisma.service';

// Retry only database conflicts; callbacks must not perform external side effects.
export async function serializable<T>(prisma: PrismaService, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }); }
    catch (error: any) {
      if (!['P2034', 'P2002'].includes(error?.code)) throw error;
      if (attempt === 3) throw new ConflictException('Concurrent operation conflict; retry using the same idempotency key');
    }
  }
  throw new ConflictException('Transaction conflict');
}
