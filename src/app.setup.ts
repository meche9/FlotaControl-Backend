import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_PREFIX, parseOrigins } from './config/constants.js';

function parseTrustProxy(value: string | undefined): boolean | number | string | undefined {
  if (!value) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const hops = Number(value);
  return Number.isInteger(hops) ? hops : value;
}

/**
 * Configuración HTTP común de la aplicación (usada por main.ts y por las pruebas e2e).
 */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);

  // Prefijo global de API
  app.setGlobalPrefix(API_PREFIX);

  // Detrás de un proxy/balanceador: necesario para que el rate limit use la IP real
  const trustProxy = parseTrustProxy(config.get<string>('TRUST_PROXY'));
  if (trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
  }

  // Seguridad HTTP Headers (OWASP A05)
  app.use(helmet());

  // Lectura de la cookie httpOnly del refresh token
  app.use(cookieParser());

  // CORS restringido a los orígenes del frontend (OWASP A05)
  app.enableCors({
    origin: parseOrigins(config.get<string>('CORS_ORIGINS')),
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
}
