import { Module } from '@nestjs/common';

import { PythonController } from './python.controller.js';
import { PythonService } from './python.service.js';

@Module({
  controllers: [PythonController],
  providers: [PythonService],
})
export class PythonModule {}