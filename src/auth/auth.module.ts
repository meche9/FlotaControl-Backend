import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PerfilService } from './perfil.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { MailModule } from '../mail/mail.module.js';
import { ImagenesModule } from '../imagenes/imagenes.module.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../config/constants.js';

@Module({
  imports: [
    MailModule,
    ImagenesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // Algoritmo fijo en firma y verificación: evita ataques de "alg confusion"
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.getOrThrow<number>('JWT_ACCESS_TTL_MINUTES') * 60,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PerfilService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
