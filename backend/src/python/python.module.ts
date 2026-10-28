import { Module } from '@nestjs/common';

import { PythonClient } from './python-client.service.js';
import { PythonController } from './python.controller.js';
import { PythonService } from './python.service.js';

@Module({
  controllers: [PythonController],
  providers: [PythonService, PythonClient],
  exports: [PythonClient],
})
export class PythonModule {}