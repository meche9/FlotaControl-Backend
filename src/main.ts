import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // Seguridad HTTP Headers (OWASP A05)
  app.use(helmet());

  // CORS configurado para el frontend (OWASP A05)
  app.enableCors({
    origin: [
      'http://localhost:5173',  // Vite dev server
      'http://localhost:4173',  // Vite preview
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 3600,
  });

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