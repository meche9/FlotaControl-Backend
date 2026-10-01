// Prueba de extremo a extremo del flujo de autenticación sobre la app Nest real
// (guards globales, cookies, CORS/CSRF, validación y rate limit), con Prisma en memoria.
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearPrismaFalso, ROL_ADMIN_ID, ROL_OPERADOR_ID } from './utils/prisma-falso.js';

const PASSWORD = 'Clave$egura2026';
const ORIGEN_FRONTEND = 'http://localhost:5173';

function cookieDeSesion(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((c) => c.startsWith('ff_rt='));
}

describe('Autenticación (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let tokenAdmin: string;
  let cookieAdmin: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://test:test@localhost:3306/test',
      JWT_SECRET: 'secreto-e2e-con-mas-de-treinta-y-dos-caracteres',
      BCRYPT_ROUNDS: '4',
      CORS_ORIGINS: ORIGEN_FRONTEND,
    });
    Logger.overrideLogger(false);

    // Import dinámico: ConfigModule valida el entorno al cargar AppModule
    const { AppModule } = await import('../src/app.module.js');
    const { configurarApp } = await import('../src/app.setup.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');

    const db = crearPrismaFalso();
    const hash = bcrypt.hashSync(PASSWORD, 4);
    db.agregarUsuario({ email: 'admin@fleetflow.com', passwordHash: hash, rolId: ROL_ADMIN_ID });
    db.agregarUsuario({ email: 'operador@fleetflow.com', passwordHash: hash, rolId: ROL_OPERADOR_ID });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db.prisma)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    await app.init();
    http = app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('protege todas las rutas salvo las públicas de autenticación', async () => {
    for (const ruta of ['/api/v1/vehiculos', '/api/v1/conductores', '/api/v1/usuarios', '/api/v1/auth/profile']) {
      await request(http).get(ruta).expect(401);
    }
  });

  it('login devuelve el access token y deja el refresh token en una cookie httpOnly', async () => {
    const res = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@fleetflow.com', password: PASSWORD })
      .expect(200);

    expect(res.body).toMatchObject({ accessToken: expect.any(String), expiresIn: 900 });
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    const cookie = cookieDeSesion(res)!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    // Sin "recordar" es cookie de sesión (sin Expires)
    expect(cookie).not.toMatch(/Expires=/);

    tokenAdmin = res.body.accessToken;
    cookieAdmin = cookie.split(';')[0];
  });

  it('el access token da acceso a rutas protegidas', async () => {
    const perfil = await request(http)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(perfil.body.email).toBe('admin@fleetflow.com');

    await request(http).get('/api/v1/usuarios').set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
  });

  it('la gestión de usuarios está restringida a administradores', async () => {
    const res = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'operador@fleetflow.com', password: PASSWORD, recordar: true })
      .expect(200);
    expect(cookieDeSesion(res)).toMatch(/Expires=/);

    await request(http)
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(403);
  });

  it('refresh rota la cookie, rechaza otros orígenes y detecta reutilización', async () => {
    await request(http)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieAdmin)
      .set('Origin', 'https://sitio-malicioso.example')
      .expect(403);

    const res = await request(http)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieAdmin)
      .set('Origin', ORIGEN_FRONTEND)
      .expect(200);
    const nuevaCookie = cookieDeSesion(res)!.split(';')[0];
    expect(nuevaCookie).not.toBe(cookieAdmin);
    expect(res.body.user.email).toBe('admin@fleetflow.com');

    // Reutilizar la cookie anterior revoca la sesión completa
    const reuso = await request(http)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieAdmin)
      .set('Origin', ORIGEN_FRONTEND)
      .expect(401);
    expect(cookieDeSesion(reuso)).toMatch(/^ff_rt=;/);

    await request(http)
      .post('/api/v1/auth/refresh')
      .set('Cookie', nuevaCookie)
      .set('Origin', ORIGEN_FRONTEND)
      .expect(401);
  });

  it('logout revoca la sesión y borra la cookie', async () => {
    const login = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@fleetflow.com', password: PASSWORD })
      .expect(200);
    const cookie = cookieDeSesion(login)!.split(';')[0];

    const res = await request(http)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', ORIGEN_FRONTEND)
      .expect(204);
    expect(cookieDeSesion(res)).toMatch(/^ff_rt=;/);

    await request(http)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .set('Origin', ORIGEN_FRONTEND)
      .expect(401);
  });

  it('forgot-password no revela si el email existe ni devuelve el token', async () => {
    const existente = await request(http)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'admin@fleetflow.com' })
      .expect(200);
    const inexistente = await request(http)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nadie@fleetflow.com' })
      .expect(200);

    expect(existente.body).toEqual(inexistente.body);
    expect(existente.body).not.toHaveProperty('resetToken');
  });

  it('valida la entrada: política de contraseñas y propiedades no permitidas', async () => {
    const debil = await request(http)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'a'.repeat(64), newPassword: 'corta' })
      .expect(400);
    expect(JSON.stringify(debil.body.message)).toMatch(/al menos 8 caracteres/);

    await request(http)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'a'.repeat(64), newPassword: 'NuevaClave#2026', rolId: 1 })
      .expect(400);

    await request(http)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'a'.repeat(64), newPassword: 'NuevaClave#2026' })
      .expect(400, /inválido o ha expirado/);
  });

  it('limita los intentos de login por IP', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: `intruso${i}@fleetflow.com`, password: 'Incorrecta#1' });
      estados.push(res.status);
    }
    expect(estados).toContain(429);
  });
});
