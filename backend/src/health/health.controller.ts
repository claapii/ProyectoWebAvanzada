import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Estado completo: NestJS, PostgreSQL, Python y última ingesta. 503 si la base no responde. */
  @Get()
  async healthCheck() {
    const report = await this.healthService.check();
    if (report.status === 'down') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }

  /** Solo indica que el proceso está vivo; no consulta dependencias. */
  @Get('live')
  live() {
    return { status: 'ok', service: 'nestjs-backend' };
  }
}