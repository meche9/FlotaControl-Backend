import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Prefijo, headers de seguridad, cookies, CORS y validación (ver app.setup.ts)
  configurarApp(app);
  app.enableShutdownHooks();

  await app.listen(app.get(ConfigService).get<number>('PORT') ?? 3000);
}
// FlotaControl Backend bootstrap - reloaded
void bootstrap();
