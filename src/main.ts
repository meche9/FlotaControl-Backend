import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Activa la validación global para todos los DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades que no estén en el DTO
      forbidNonWhitelisted: true, // Lanza error si envían propiedades no permitidas
      transform: true, // Transforma los tipos automáticamente (ej. string a int en parámetros)
    }),
  );

  await app.listen(3000);
}
bootstrap();