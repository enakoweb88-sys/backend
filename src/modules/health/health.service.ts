import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private pending?: Promise<boolean>;

  constructor(private readonly prisma: PrismaService) {}

  async isHealthy(): Promise<boolean> {
    // Share a probe so an unavailable connection cannot accumulate pending checks.
    if (!this.pending) {
      const probe = this.probe().then(() => true, () => false);
      this.pending = probe;
      void probe.then(() => { if (this.pending === probe) this.pending = undefined; });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Also bound the response if the driver stalls before opening a transaction.
      return await Promise.race([
        this.pending,
        new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 1500); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async probe(): Promise<void> {
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      // Transaction-local: does not alter pooled connections or database configuration.
      await tx.$executeRaw`SET LOCAL statement_timeout = '750ms'`;
      await tx.$queryRaw`SELECT 1`;
    }, { maxWait: 500, timeout: 1000 });
  }
}
