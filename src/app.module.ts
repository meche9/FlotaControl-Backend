// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js'
import { VehiculosModule } from './vehiculos/vehiculos.module.js';
import { ConductoresModule } from './conductores/conductores.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { validateEnv } from './config/env.validation.js';

@Module({
  imports: [
    // Variables de entorno globales, validadas al arrancar (OWASP A05)
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),

    // Rate Limiting general: 100 peticiones por minuto por IP (OWASP A04/A07).
    // Los endpoints de autenticación definen límites más estrictos con @Throttle().
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),

    PrismaModule,
    AuthModule,
    UsuariosModule,
    VehiculosModule,
    ConductoresModule,
  ],
  controllers: [],
  providers: [
    // Los guards globales se ejecutan en este orden:
    // 1. Rate limiting (antes de tocar la BD) (OWASP A07)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 2. JWT: protege todas las rutas salvo las marcadas con @Public() (OWASP A01)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 3. Roles: aplica las restricciones declaradas con @Roles() (OWASP A01)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
