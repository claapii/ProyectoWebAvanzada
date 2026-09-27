import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PythonService {
  constructor(private readonly configService: ConfigService) {}

  async getHealth() {
    const pythonUrl =
      this.configService.get<string>('PYTHON_SERVICE_URL') ??
      'http://localhost:8000';

    try {
      const response = await fetch(`${pythonUrl}/health`);

      if (!response.ok) {
        throw new Error('FastAPI respondió con error');
      }

      return await response.json();
    } catch {
      throw new ServiceUnavailableException(
        'El servicio Python no está disponible',
      );
    }
  }
}