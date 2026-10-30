import { ConfigService } from '@nestjs/config';

import { PythonClient } from './python-client.service.js';
import { PythonServiceError } from './python.errors.js';

const API_KEY = 'clave-interna-de-prueba';

function clientWith(overrides: Record<string, string> = {}) {
  return new PythonClient(
    new ConfigService({
      PYTHON_SERVICE_URL: 'http://python:8000/',
      INTERNAL_API_KEY: API_KEY,
      PYTHON_TIMEOUT_MS: '200',
      PYTHON_MAX_RETRIES: '2',
      PYTHON_RETRY_DELAY_MS: '1',
      ...overrides,
    }),
  );
}

function validBody() {
  return {
    status: 'ok',
    provenance: {
      source_name: 'PUCV - Plan de Estudios',
      source_url: 'https://pucv.cl/plan.pdf',
      fetched_at: '2026-10-23T23:25:13.409657Z',
      sha256: 'a'.repeat(64),
      content_length: 100706,
      resolution: 'DRA 61/2020',
      from_cache: false,
      changed: null,
      extractor_version: '2.0.0',
    },
    metrics: {
      candidates: 2,
      valid: 2,
      rejected: 0,
      duplicates: 0,
      semesters_detected: 11,
      semesters_expected: 11,
      coverage: 1,
      valid_ratio: 1,
      duration_ms: 1158,
    },
    courses: [
      { code: 'algebra-lineal', name: 'Álgebra Lineal', semester: 2, category: 'Ciencias Básicas' },
      { code: 'optativo-1', name: 'Optativo 1', semester: 8, category: null },
    ],
    warnings: [],
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const pythonError = (code: string, status: number) =>
  json({ error: { code, message: 'detalle interno', request_id: 'x' } }, status);

describe('PythonClient', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  async function failureOf(promise: Promise<unknown>): Promise<PythonServiceError> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(PythonServiceError);
      return error as PythonServiceError;
    }
    throw new Error('Se esperaba un error y la llamada tuvo éxito');
  }

  describe('contrato y autenticación', () => {
    it('envía la clave interna, el request-id y el cuerpo esperado', async () => {
      fetchSpy.mockResolvedValue(json(validBody()));

      await clientWith().ingestCurriculum('req-123', false);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('http://python:8000/ingest/curriculum');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        'X-Internal-Api-Key': API_KEY,
        'X-Request-Id': 'req-123',
      });
      expect(JSON.parse(init?.body as string)).toEqual({ allow_cache_fallback: false });
    });

    it('traduce la respuesta de Python a camelCase y a tipos propios', async () => {
      fetchSpy.mockResolvedValue(json(validBody()));

      const result = await clientWith().ingestCurriculum();

      expect(result.status).toBe('ok');
      expect(result.provenance.fetchedAt).toBeInstanceOf(Date);
      expect(result.provenance.sha256).toHaveLength(64);
      expect(result.metrics.semestersDetected).toBe(11);
      expect(result.courses[0]).toEqual({
        code: 'algebra-lineal',
        name: 'Álgebra Lineal',
        semester: 2,
        category: 'Ciencias Básicas',
      });
      expect(result.courses[1].category).toBeNull();
    });

    it('falla sin llamar a Python si no hay clave interna configurada', async () => {
      const error = await failureOf(
        clientWith({ INTERNAL_API_KEY: '' }).ingestCurriculum(),
      );

      expect(error.code).toBe('PYTHON_AUTH_FAILED');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('si Python rechaza la clave responde PYTHON_AUTH_FAILED sin reintentar', async () => {
      fetchSpy.mockResolvedValue(json({ error: { code: 'HTTP_ERROR' } }, 401));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('PYTHON_AUTH_FAILED');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('indisponibilidad y reintentos limitados', () => {
    it('reintenta ante un 503 transitorio y termina con éxito', async () => {
      fetchSpy
        .mockResolvedValueOnce(pythonError('HTTP_ERROR', 503))
        .mockResolvedValueOnce(json(validBody()));

      const result = await clientWith().ingestCurriculum();

      expect(result.courses).toHaveLength(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('agota los reintentos y responde PYTHON_UNAVAILABLE', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('PYTHON_UNAVAILABLE');
      expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 intento + 2 reintentos
    });

    it('respeta PYTHON_MAX_RETRIES=0: un solo intento', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      await failureOf(clientWith({ PYTHON_MAX_RETRIES: '0' }).ingestCurriculum());

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('corta una llamada que excede el tiempo máximo y no queda bloqueado', async () => {
      // Python "colgado": nunca responde; solo termina cuando se aborta la señal.
      fetchSpy.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      );

      const started = Date.now();
      const error = await failureOf(
        clientWith({ PYTHON_TIMEOUT_MS: '30', PYTHON_MAX_RETRIES: '1' }).ingestCurriculum(),
      );

      expect(error.code).toBe('PYTHON_TIMEOUT');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(Date.now() - started).toBeLessThan(2000);
    });
  });

  describe('errores deterministas: no se reintentan', () => {
    it.each([
      ['ROBOTS_DISALLOWED', 403],
      ['EXTRACTION_FAILED', 502],
      ['SOURCE_INVALID', 502],
    ])('%s se informa tal cual y con una sola llamada', async (code, status) => {
      fetchSpy.mockResolvedValue(pythonError(code, status));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe(code);
      expect(error.httpStatus).toBe(status);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('SOURCE_UNAVAILABLE (la fuente web cayó) se informa como tal', async () => {
      fetchSpy.mockResolvedValue(pythonError('SOURCE_UNAVAILABLE', 503));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('SOURCE_UNAVAILABLE');
    });

    it('un error 500 sin formato conocido se clasifica como PYTHON_ERROR', async () => {
      fetchSpy.mockResolvedValue(new Response('boom', { status: 500 }));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('PYTHON_ERROR');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('respuestas inválidas', () => {
    it('rechaza una respuesta que no es JSON', async () => {
      fetchSpy.mockResolvedValue(new Response('<html>hola</html>', { status: 200 }));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('PYTHON_INVALID_RESPONSE');
    });

    it('rechaza una respuesta a la que le falta un campo del contrato', async () => {
      const body: Record<string, unknown> = validBody();
      delete body.courses;
      fetchSpy.mockResolvedValue(json(body));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('PYTHON_INVALID_RESPONSE');
    });

    it('rechaza valores fuera de rango (semestre 99)', async () => {
      const body = validBody();
      body.courses[0].semester = 99;
      fetchSpy.mockResolvedValue(json(body));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('PYTHON_INVALID_RESPONSE');
    });

    it('rechaza una lista sin asignaturas', async () => {
      const body = validBody();
      body.courses = [];
      fetchSpy.mockResolvedValue(json(body));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('PYTHON_INVALID_RESPONSE');
    });

    it('rechaza códigos de asignatura duplicados', async () => {
      const body = validBody();
      body.courses[1].code = body.courses[0].code;
      fetchSpy.mockResolvedValue(json(body));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.code).toBe('PYTHON_INVALID_RESPONSE');
      expect(error.message).toContain('duplicadas');
    });

    it('no reintenta una respuesta inválida: reintentar no la corrige', async () => {
      fetchSpy.mockResolvedValue(new Response('no es json', { status: 200 }));

      await failureOf(clientWith().ingestCurriculum());

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('seguridad', () => {
    it('los errores nunca contienen la clave interna ni el detalle de Python', async () => {
      fetchSpy.mockResolvedValue(pythonError('EXTRACTION_FAILED', 502));

      const error = await failureOf(clientWith().ingestCurriculum());

      expect(error.message).not.toContain(API_KEY);
      expect(error.message).not.toContain('detalle interno');
    });
  });

  describe('health', () => {
    it('devuelve el estado cuando Python responde', async () => {
      fetchSpy.mockResolvedValue(json({ status: 'ok', service: 'python-fastapi' }));

      await expect(clientWith().health()).resolves.toEqual({
        status: 'ok',
        service: 'python-fastapi',
      });
    });

    it('responde PYTHON_UNAVAILABLE si Python no está accesible', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      const error = await failureOf(clientWith().health());

      expect(error.code).toBe('PYTHON_UNAVAILABLE');
    });
  });
});