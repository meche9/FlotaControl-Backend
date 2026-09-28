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

@Module({
  imports: [
    // Variables de entorno globales
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Rate Limiting: máximo 20 peticiones por 60 segundos por IP (OWASP A07)
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 20,
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
    // Guard global JWT: protege todas las rutas por defecto (OWASP A01)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Guard global de rate limiting (OWASP A07)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}