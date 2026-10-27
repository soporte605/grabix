import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  Logger.log(`API lista en http://localhost:${port}/api`, 'Grabix');
}
void bootstrap();
