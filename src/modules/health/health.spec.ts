import { Controller, Get, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { HealthModule } from './health.module';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpRateLimitGuard } from '../../common/http-rate-limit.guard';
import { GatewayAccess, GatewayAccessGuard } from '../../common/gateway-access';
import { AuthService } from '../auth/auth.service';
import { CashAuthService } from '../cash-collections/cash-auth.service';
import { SafeExceptionFilter } from '../../common/safe-exception.filter';

describe('HealthService', () => {
  const transaction = jest.fn();
  let service: HealthService;
  beforeEach(() => { transaction.mockReset(); service = new HealthService({ $transaction: transaction } as unknown as PrismaService); });
  afterEach(() => jest.useRealTimers());

  it('uses a read-only SELECT 1 with bounded transaction and statement timeouts', async () => {
    const execute = jest.fn().mockResolvedValue(0), query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    transaction.mockImplementation(async callback => callback({ $executeRaw: execute, $queryRaw: query }));
    expect(await service.isHealthy()).toBe(true);
    expect(transaction.mock.calls[0][1]).toEqual({ maxWait: 500, timeout: 1000 });
    expect(execute.mock.calls.map(([sql]) => sql.join(''))).toEqual(['SET TRANSACTION READ ONLY', "SET LOCAL statement_timeout = '750ms'"]);
    expect(query.mock.calls[0][0].join('')).toBe('SELECT 1');
  });

  it('reports failure without propagating database exceptions', async () => {
    transaction.mockRejectedValue(new Error('private database details'));
    expect(await service.isHealthy()).toBe(false);
  });

  it('returns within 1500ms when acquisition stalls and shares the pending probe', async () => {
    jest.useFakeTimers();
    let resolveProbe!: () => void;
    transaction.mockImplementation(() => new Promise<void>(resolve => { resolveProbe = resolve; }));
    const first = service.isHealthy(), second = service.isHealthy();
    await jest.advanceTimersByTimeAsync(1500);
    expect(await first).toBe(false); expect(await second).toBe(false);
    expect(transaction).toHaveBeenCalledTimes(1);
    const third = service.isHealthy();
    expect(transaction).toHaveBeenCalledTimes(1);
    resolveProbe(); expect(await third).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retries successfully after an unavailable dependency recovers', async () => {
    transaction.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    expect(await service.isHealthy()).toBe(false);
    expect(await service.isHealthy()).toBe(true);
  });
});

@Controller('protected-health-fixture')
class ProtectedFixture {
  @Get() read() { return { private: true }; }
}

describe('Registered public health route with real global guards', () => {
  let app: INestApplication, base: string;
  const transaction = jest.fn(), increment = jest.fn(), verifyGateway = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [HealthModule], controllers: [ProtectedFixture] })
      .overrideProvider(PrismaService).useValue({ $transaction: transaction }).compile();
    app = module.createNestApplication({ logger: false }); app.setGlobalPrefix('api/v1');
    const reflector = new Reflector();
    const config = { get: (key: string) => key === 'RATE_LIMIT_HASH_SECRET' ? 'a'.repeat(64) : undefined } as ConfigService;
    const limiter = new HttpRateLimitGuard([{ ttl: 60000, limit: 120 }], { increment } as unknown as ThrottlerStorage, reflector, config, {} as AuthService, {} as CashAuthService);
    await limiter.onModuleInit();
    app.useGlobalGuards(limiter, new GatewayAccessGuard(reflector, { verify: verifyGateway } as unknown as GatewayAccess));
    app.useGlobalFilters(new SafeExceptionFilter());
    await app.listen(0, '127.0.0.1'); base = await app.getUrl();
  });
  beforeEach(() => {
    transaction.mockReset(); increment.mockReset(); verifyGateway.mockReset();
    increment.mockRejectedValue(new Error('private limiter dependency unavailable'));
    verifyGateway.mockRejectedValue(new UnauthorizedException());
  });
  afterAll(async () => { await app?.close(); });

  it('registers GET /api/v1/health and returns minimal 200 JSON without any authentication', async () => {
    transaction.mockResolvedValue(undefined);
    const response = await fetch(base + '/api/v1/health');
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(increment).not.toHaveBeenCalled(); expect(verifyGateway).not.toHaveBeenCalled();
  });

  it('returns minimal 503 JSON when PostgreSQL and the database-backed limiter are unavailable', async () => {
    transaction.mockRejectedValue(new Error('postgresql://fixture:synthetic@127.0.0.1/database private stack'));
    const response = await fetch(base + '/api/v1/health');
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(increment).not.toHaveBeenCalled(); expect(verifyGateway).not.toHaveBeenCalled();
  });

  it('returns 503 over HTTP after the response deadline if the database never responds', async () => {
    transaction.mockImplementation(() => new Promise(() => {}));
    const start = Date.now();
    const response = await fetch(base + '/api/v1/health');
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it('keeps the existing limiter and gateway guards active for unrelated routes', async () => {
    increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60 });
    const response = await fetch(base + '/api/v1/protected-health-fixture');
    expect(response.status).toBe(401); expect(increment).toHaveBeenCalled(); expect(verifyGateway).toHaveBeenCalled();
  });
});
