import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PythonModule } from '../python/python.module.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionService } from './ingestion.service.js';

@Module({
  imports: [AuthModule, PythonModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}