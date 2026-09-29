import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { crearPrismaFalso } from '../../test/utils/prisma-falso.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../config/constants.js';

const PASSWORD = 'Clave$egura2026';
const EMAIL = 'admin@fleetflow.com';
const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

function crearJwtService() {
  return new JwtService({
    secret: 'secreto-de-pruebas-con-mas-de-32-caracteres',
    signOptions: { algorithm: 'HS256', expiresIn: 900, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  });
}

describe('AuthService', () => {
  let db: ReturnType<typeof crearPrismaFalso>;
  let jwt: JwtService;
  let mail: { enviarRestablecimiento: ReturnType<typeof vi.fn>; enviarAvisoCambioPassword: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeAll(() => Logger.overrideLogger(false));

  beforeEach(() => {
    db = crearPrismaFalso();
    db.agregarUsuario({ email: EMAIL, passwordHash: bcrypt.hashSync(PASSWORD, 4) });
    jwt = crearJwtService();
    mail = {
      enviarRestablecimiento: vi.fn(async () => undefined),
      enviarAvisoCambioPassword: vi.fn(async () => undefined),
    };
    const config = new ConfigService({ BCRYPT_ROUNDS: 4, FRONTEND_URL: 'http://localhost:5173' });
    service = new AuthService(db.prisma as any, jwt, mail as any, config);
  });

  async function solicitarTokenReset(email = EMAIL): Promise<string> {
    service.forgotPassword({ email });
    await vi.waitFor(() => expect(mail.enviarRestablecimiento).toHaveBeenCalled());
    const enlace: string = mail.enviarRestablecimiento.mock.lastCall![1];
    return enlace.split('#token=')[1];
  }

  describe('login', () => {
    it('emite un access token y guarda solo el hash del refresh token', async () => {
      const sesion = await service.login({ email: ' Admin@FleetFlow.com ', password: PASSWORD });

      const payload = await jwt.verifyAsync(sesion.accessToken);
      expect(payload).toMatchObject({ sub: db.usuarios[0].id, typ: 'access', ver: 0 });
      expect(sesion.user).not.toHaveProperty('passwordHash');
      expect(sesion.user).not.toHaveProperty('tokenVersion');
      expect(db.refreshTokens).toHaveLength(1);
      expect(db.refreshTokens[0].tokenHash).toBe(sha256(sesion.refreshToken));
      expect(db.refreshTokens[0].tokenHash).not.toBe(sesion.refreshToken);
    });

    it('responde igual para email inexistente y contraseña incorrecta', async () => {
      await expect(service.login({ email: 'nadie@fleetflow.com', password: PASSWORD })).rejects.toThrow(
        'Credenciales inválidas',
      );
      await expect(service.login({ email: EMAIL, password: 'Incorrecta#1' })).rejects.toThrow(
        'Credenciales inválidas',
      );
    });

    it('no revela que la cuenta está suspendida sin la contraseña correcta', async () => {
      db.usuarios[0].estado = 'suspendido';

      await expect(service.login({ email: EMAIL, password: 'Incorrecta#1' })).rejects.toThrow(
        'Credenciales inválidas',
      );
      await expect(service.login({ email: EMAIL, password: PASSWORD })).rejects.toThrow(
        /inactiva o suspendida/,
      );
    });

    it('bloquea tras 5 intentos fallidos, también para emails inexistentes', async () => {
      for (const email of [EMAIL, 'nadie@fleetflow.com']) {
        for (let i = 0; i < 5; i++) {
          await expect(service.login({ email, password: 'Incorrecta#1' })).rejects.toBeInstanceOf(
            UnauthorizedException,
          );
        }
        await expect(service.login({ email, password: PASSWORD })).rejects.toMatchObject({ status: 429 });
      }
    });

    it('trata como inválido un hash que no es bcrypt (contraseña legada en texto plano)', async () => {
      db.usuarios[0].passwordHash = PASSWORD;
      await expect(service.login({ email: EMAIL, password: PASSWORD })).rejects.toThrow(
        'Credenciales inválidas',
      );
    });
  });

  describe('refresh', () => {
    it('rota el token manteniendo la familia y la expiración absoluta', async () => {
      const inicial = await service.login({ email: EMAIL, password: PASSWORD, recordar: true });
      const rotada = await service.refresh(inicial.refreshToken);

      expect(rotada.refreshToken).not.toBe(inicial.refreshToken);
      expect(rotada.refreshExpiraEn.getTime()).toBe(inicial.refreshExpiraEn.getTime());
      expect(rotada.recordar).toBe(true);
      expect(db.refreshTokens[0].revocadoEn).toBeInstanceOf(Date);
      expect(db.refreshTokens[1].familia).toBe(db.refreshTokens[0].familia);
    });

    it('al detectar reutilización revoca toda la familia', async () => {
      const inicial = await service.login({ email: EMAIL, password: PASSWORD });
      const rotada = await service.refresh(inicial.refreshToken);

      await expect(service.refresh(inicial.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.refresh(rotada.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza tokens desconocidos, vencidos o de usuarios inactivos', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.refresh('token-inventado')).rejects.toBeInstanceOf(UnauthorizedException);

      const vencida = await service.login({ email: EMAIL, password: PASSWORD });
      db.refreshTokens[0].expiraEn = new Date(Date.now() - 1000);
      await expect(service.refresh(vencida.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

      const activa = await service.login({ email: EMAIL, password: PASSWORD });
      db.usuarios[0].estado = 'inactivo';
      await expect(service.refresh(activa.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('logout invalida la sesión', async () => {
      const sesion = await service.login({ email: EMAIL, password: PASSWORD });
      await service.logout(sesion.refreshToken);
      await expect(service.refresh(sesion.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('restablecimiento de contraseña', () => {
    it('responde igual exista o no el email y nunca devuelve el token', async () => {
      const existente = service.forgotPassword({ email: EMAIL });
      const inexistente = service.forgotPassword({ email: 'nadie@fleetflow.com' });

      expect(existente).toEqual(inexistente);
      expect(existente).not.toHaveProperty('resetToken');
      await vi.waitFor(() => expect(mail.enviarRestablecimiento).toHaveBeenCalledTimes(1));
    });

    it('envía un enlace con token de un solo uso y guarda solo su hash', async () => {
      const token = await solicitarTokenReset();

      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(mail.enviarRestablecimiento.mock.lastCall![1]).toBe(
        `http://localhost:5173/reset-password#token=${token}`,
      );
      expect(db.resetTokens).toHaveLength(1);
      expect(db.resetTokens[0].token).toBe(sha256(token));
    });

    it('no reenvía correos en ráfaga a la misma cuenta', async () => {
      await solicitarTokenReset();
      service.forgotPassword({ email: EMAIL });
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mail.enviarRestablecimiento).toHaveBeenCalledTimes(1);
      expect(db.resetTokens).toHaveLength(1);
    });

    it('cambia la contraseña, consume el token y cierra todas las sesiones', async () => {
      const sesion = await service.login({ email: EMAIL, password: PASSWORD });
      const token = await solicitarTokenReset();

      await service.resetPassword({ token, newPassword: 'NuevaClave#2026' });

      expect(db.usuarios[0].tokenVersion).toBe(1);
      expect(await bcrypt.compare('NuevaClave#2026', db.usuarios[0].passwordHash)).toBe(true);
      await expect(service.refresh(sesion.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.login({ email: EMAIL, password: PASSWORD })).rejects.toThrow('Credenciales inválidas');
      await expect(service.login({ email: EMAIL, password: 'NuevaClave#2026' })).resolves.toBeDefined();
      await expect(service.resetPassword({ token, newPassword: 'OtraClave#2026' })).rejects.toThrow(
        'El enlace de restablecimiento es inválido o ha expirado',
      );
      await vi.waitFor(() => expect(mail.enviarAvisoCambioPassword).toHaveBeenCalledTimes(1));
    });

    it('rechaza tokens vencidos', async () => {
      const token = await solicitarTokenReset();
      db.resetTokens[0].expiraEn = new Date(Date.now() - 1000);

      await expect(service.resetPassword({ token, newPassword: 'NuevaClave#2026' })).rejects.toThrow(
        'El enlace de restablecimiento es inválido o ha expirado',
      );
    });
  });
});
