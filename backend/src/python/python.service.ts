import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PythonClient } from './python-client.service.js';

@Injectable()
export class PythonService {
  constructor(private readonly pythonClient: PythonClient) {}

  async getHealth() {
    try {
      return await this.pythonClient.health();
    } catch {
      throw new ServiceUnavailableException(
        'El servicio Python no está disponible',
      );
    }
  }
}