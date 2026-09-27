import { Controller, Get } from '@nestjs/common';
import { PythonService } from './python.service.js';

@Controller('python')
export class PythonController {
  constructor(private readonly pythonService: PythonService) {}

  @Get('health')
  getHealth() {
    return this.pythonService.getHealth();
  }
}