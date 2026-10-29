import { randomUUID } from 'node:crypto';

import { Controller, Get, Headers, Post, Query } from '@nestjs/common';

import { Auth } from '../auth/auth.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { ListRunsQueryDto } from './dto/list-runs-query.dto.js';
import { IngestionService } from './ingestion.service.js';

// Solo se acepta un identificador simple del cliente; si no, se genera uno.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('curriculum')
  @Auth(Role.ADMIN)
  ingestCurriculum(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-request-id') requestId?: string,
  ) {
    const id =
      requestId && REQUEST_ID_PATTERN.test(requestId) ? requestId : randomUUID();
    return this.ingestionService.ingestCurriculum(user, id);
  }

  @Get('runs')
  @Auth(Role.ADMIN)
  listRuns(@Query() query: ListRunsQueryDto) {
    return this.ingestionService.listRuns(query.limit);
  }
}