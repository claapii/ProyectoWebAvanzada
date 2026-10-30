import { Module } from '@nestjs/common';

import { PythonModule } from '../python/python.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [PythonModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}