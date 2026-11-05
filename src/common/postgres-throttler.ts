import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PrismaService } from '../modules/prisma/prisma.service';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class PostgresThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly prisma: PrismaService) {}
  @Interval(60000)
  async cleanup() {
    // Bounded cleanup; expired buckets do not need to be retained as activity history.
    await this.prisma.$executeRaw`DELETE FROM rate_limit_buckets WHERE key IN (SELECT key FROM rate_limit_buckets WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '1 hour' LIMIT 5000)`;
  }
  async increment(key: string, ttl: number) {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ hits: number; remaining: number }>>`
        INSERT INTO rate_limit_buckets (key, hits, "expiresAt")
        VALUES (${key}, 1, CURRENT_TIMESTAMP + ${ttl} * INTERVAL '1 millisecond')
        ON CONFLICT (key) DO UPDATE SET
          hits = CASE WHEN rate_limit_buckets."expiresAt" <= CURRENT_TIMESTAMP THEN 1 ELSE rate_limit_buckets.hits + 1 END,
          "expiresAt" = CASE WHEN rate_limit_buckets."expiresAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."expiresAt" ELSE rate_limit_buckets."expiresAt" END
        RETURNING hits, GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - CURRENT_TIMESTAMP))))::integer AS remaining
      `;
      return { totalHits: Number(rows[0].hits), timeToExpire: Number(rows[0].remaining) };
    } catch { throw new ServiceUnavailableException('Request limiting is unavailable; retry later'); }
  }
}
