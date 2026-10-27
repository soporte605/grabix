import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Detrás de Nginx: la IP real del visitante viene en X-Forwarded-For.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  Logger.log(`API lista en http://localhost:${port}/api`, 'Grabix');
}
void bootstrap();
