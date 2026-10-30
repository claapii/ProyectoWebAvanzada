import { JsonLogger, redact } from './json-logger.js';
import { runWithRequestId } from './request-context.js';

describe('JsonLogger', () => {
  const logger = new JsonLogger();
  const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  const lastEntry = (spy: typeof out) =>
    JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;

  beforeEach(() => {
    out.mockClear();
    err.mockClear();
  });

  afterAll(() => {
    out.mockRestore();
    err.mockRestore();
  });

  it('escribe una línea JSON con fecha, nivel, mensaje y contexto', () => {
    logger.log('hola', 'MiContexto');

    const entry = lastEntry(out);
    expect(entry).toMatchObject({ level: 'info', message: 'hola', context: 'MiContexto' });
    expect(new Date(entry.ts as string).toISOString()).toBe(entry.ts);
  });

  it('un mensaje en forma de objeto se expande en campos propios', () => {
    logger.log({ event: 'http_request', status: 200, duration_ms: 12 });

    const entry = lastEntry(out);
    expect(entry).toMatchObject({ event: 'http_request', status: 200, duration_ms: 12 });
    expect(entry).not.toHaveProperty('message');
  });

  it('incluye el identificador de la solicitud en curso', () => {
    runWithRequestId('req-77', () => logger.log('dentro'));
    logger.log('fuera');

    expect(JSON.parse(String(out.mock.calls[0][0]))).toMatchObject({ request_id: 'req-77' });
    expect(lastEntry(out)).not.toHaveProperty('request_id');
  });

  it('un request_id explícito tiene prioridad sobre el del contexto', () => {
    runWithRequestId('del-contexto', () => logger.log({ request_id: 'explicito' }));

    expect(lastEntry(out)).toMatchObject({ request_id: 'explicito' });
  });

  it('los avisos van a stdout y los errores a stderr, con la traza separada', () => {
    logger.warn('cuidado');
    logger.error('falló', 'Error: x\n    at funcion (archivo.ts:1:1)', 'Contexto');

    expect(lastEntry(out)).toMatchObject({ level: 'warn', message: 'cuidado' });
    expect(lastEntry(err)).toMatchObject({
      level: 'error',
      message: 'falló',
      context: 'Contexto',
    });
    expect(String(lastEntry(err).stack)).toContain('at funcion');
  });

  it('registra un objeto Error con su mensaje y su traza', () => {
    logger.error(new Error('boom'));

    const entry = lastEntry(err);
    expect(entry.message).toBe('boom');
    expect(String(entry.stack)).toContain('Error: boom');
  });

  describe('protección de datos sensibles', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.firma_secreta-123';

    it('oculta tokens JWT y encabezados Bearer en los mensajes', () => {
      logger.log(`token recibido ${jwt}`);
      logger.log('Authorization: Bearer abc.def.ghi');

      const lines = out.mock.calls.map((call) => String(call[0]));
      expect(lines[0]).not.toContain('eyJhbGci');
      expect(lines[0]).not.toContain('firma_secreta');
      expect(lines[1]).not.toContain('abc.def.ghi');
    });

    it('oculta contraseñas y claves escritas como clave=valor', () => {
      expect(redact('password=abc123 user=ana')).toBe('password=[REDACTED] user=ana');
      expect(redact('api_key: "mi-clave-larga"')).not.toContain('mi-clave-larga');
      expect(redact('INTERNAL_API_KEY=clave-interna-1')).not.toContain('clave-interna-1');
      expect(redact('JWT_SECRET=mi-secreto-jwt')).not.toContain('mi-secreto-jwt');
      expect(redact('ADMIN_PASSWORD=otra-clave-9')).not.toContain('otra-clave-9');
    });

    it('oculta la contraseña dentro de una URL de conexión a la base de datos', () => {
      const url = 'fallo en postgresql://listoco:clave-de-la-bd@db:5432/listoco';

      const result = redact(url);

      expect(result).not.toContain('clave-de-la-bd');
      expect(result).toContain('postgresql://listoco:[REDACTED]@db:5432/listoco');
    });

    it('oculta los campos sensibles de un objeto, también los anidados', () => {
      logger.log({
        event: 'login',
        email: 'ana@correo.cl',
        password: 'secreto123',
        nested: { accessToken: jwt, authorization: 'Bearer xyz', ok: 'visible' },
      });

      const line = String(out.mock.calls.at(-1)?.[0]);
      expect(line).not.toContain('secreto123');
      expect(line).not.toContain('firma_secreta');
      expect(line).not.toContain('Bearer xyz');
      expect(lastEntry(out)).toMatchObject({
        event: 'login',
        password: '[REDACTED]',
        nested: { accessToken: '[REDACTED]', authorization: '[REDACTED]', ok: 'visible' },
      });
    });

    it('no altera el texto que no contiene datos sensibles', () => {
      const text = 'ingestion_completed request_id=abc created=58 updated=0';

      expect(redact(text)).toBe(text);
    });
  });
});