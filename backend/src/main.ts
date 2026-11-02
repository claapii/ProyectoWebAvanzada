import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { JsonLogger } from './observability/json-logger.js';
import { requestContextMiddleware } from './observability/request-context.js';

/** Orígenes permitidos para CORS, separados por coma (variable CORS_ORIGINS). */
function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS ?? 'http://localhost:8080';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });

  app.use(requestContextMiddleware);

  app.enableCors({
    origin: allowedOrigins(),
    exposedHeaders: ['X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('LISTOCO API')
    .setDescription(
      'API REST de LISTOCO: autenticación, asignaturas e ingesta de la malla curricular de la PUCV.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();