import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { Public } from '../decorators/public.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { crearPrismaFalso } from '../../../test/utils/prisma-falso.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../../config/constants.js';

const SECRETO = 'secreto-de-pruebas-con-mas-de-32-caracteres';

class RutasDePrueba {
  @Public()
  publica() {}

  protegida() {}

  @Roles('Administrador')
  soloAdmin() {}
}

function contexto(handler: keyof RutasDePrueba, request: Record<string, any>): ExecutionContext {
  return {
    getHandler: () => RutasDePrueba.prototype[handler],
    getClass: () => RutasDePrueba,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let db: ReturnType<typeof crearPrismaFalso>;
  let jwt: JwtService;
  let guard: JwtAuthGuard;
  let usuarioId: number;

  const firmar = (payload: object, secreto = SECRETO) =>
    jwt.signAsync(payload, { secret: secreto, expiresIn: 900, issuer: JWT_ISSUER, audience: JWT_AUDIENCE });

  beforeEach(() => {
    db = crearPrismaFalso();
    usuarioId = db.agregarUsuario({ email: 'admin@fleetflow.com', passwordHash: 'x' }).id;
    jwt = new JwtService({
      secret: SECRETO,
      verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    });
    guard = new JwtAuthGuard(jwt, new Reflector(), db.prisma as any);
  });

  it('permite rutas @Public() sin token', async () => {
    await expect(guard.canActivate(contexto('publica', { headers: {} }))).resolves.toBe(true);
  });

  it('rechaza rutas protegidas sin token', async () => {
    await expect(guard.canActivate(contexto('protegida', { headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('acepta un access token válido y adjunta el usuario con su rol', async () => {
    const token = await firmar({ sub: usuarioId, rolId: 1, ver: 0, typ: 'access' });
    const request: Record<string, any> = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contexto('protegida', request))).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: usuarioId, rol: 'Administrador' });
    expect(request.user).not.toHaveProperty('passwordHash');
  });

  it.each([
    ['tipo distinto de access', { typ: 'refresh' }, SECRETO],
    ['versión de credenciales desactualizada', { ver: 1 }, SECRETO],
    ['firma con otro secreto', {}, 'otro-secreto-de-pruebas-con-mas-de-32-caracteres'],
  ])('rechaza tokens con %s', async (_caso, cambios, secreto) => {
    const token = await firmar({ sub: usuarioId, rolId: 1, ver: 0, typ: 'access', ...cambios }, secreto);
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contexto('protegida', request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza tokens de usuarios desactivados', async () => {
    const token = await firmar({ sub: usuarioId, rolId: 1, ver: 0, typ: 'access' });
    db.usuarios[0].estado = 'inactivo';

    await expect(
      guard.canActivate(contexto('protegida', { headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('permite rutas sin @Roles() a cualquier usuario autenticado', () => {
    expect(guard.canActivate(contexto('protegida', { user: { rol: 'Operador' } }))).toBe(true);
  });

  it('permite el rol requerido sin distinguir mayúsculas', () => {
    expect(guard.canActivate(contexto('soloAdmin', { user: { rol: 'administrador' } }))).toBe(true);
  });

  it('rechaza otros roles con 403', () => {
    expect(() => guard.canActivate(contexto('soloAdmin', { user: { rol: 'Operador' } }))).toThrow(
      ForbiddenException,
    );
  });
});
