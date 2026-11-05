import { Controller, Get, Header, Res, SetMetadata } from '@nestjs/common';
import { Response } from 'express';
import { PublicApi } from '../../common/gateway-access';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @PublicApi()
  @SetMetadata('enako.health-check', true)
  @Header('Cache-Control', 'no-store')
  async check(@Res({ passthrough: true }) response: Response) {
    const healthy = await this.health.isHealthy();
    response.status(healthy ? 200 : 503);
    return { status: healthy ? 'ok' : 'unavailable' };
  }
}
