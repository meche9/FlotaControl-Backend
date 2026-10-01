// Prisma en memoria para pruebas unitarias del módulo de autenticación.
// Implementa solo las operaciones que usan AuthService y JwtAuthGuard.
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';

type Fila = Record<string, any>;

export const ROL_ADMIN_ID = '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7';
export const ROL_OPERADOR_ID = '0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d';

function coincide(fila: Fila, where: Fila): boolean {
  return Object.entries(where).every(([campo, valor]) => {
    if (valor && typeof valor === 'object' && !(valor instanceof Date) && 'gt' in valor) {
      return fila[campo] > valor.gt;
    }
    return fila[campo] === valor;
  });
}

function aplicar(fila: Fila, data: Fila): void {
  for (const [campo, valor] of Object.entries(data)) {
    if (valor && typeof valor === 'object' && !(valor instanceof Date) && 'increment' in valor) {
      fila[campo] += valor.increment;
    } else {
      fila[campo] = valor;
    }
  }
}

export function crearPrismaFalso() {
  const roles: Fila[] = [
    { id: ROL_ADMIN_ID, nombre: 'Administrador', descripcion: 'Acceso total', creadoEn: new Date() },
    { id: ROL_OPERADOR_ID, nombre: 'Operador', descripcion: null, creadoEn: new Date() },
  ];
  const usuarios: Fila[] = [];
  const refreshTokens: Fila[] = [];
  const resetTokens: Fila[] = [];

  const conRol = (usuario: Fila | undefined) =>
    usuario ? { ...usuario, rol: roles.find((r) => r.id === usuario.rolId) } : null;

  const buscarUsuario = (where: Fila) =>
    usuarios.find((u) => (where.id !== undefined ? u.id === where.id : u.email === where.email));

  const prisma = {
    usuario: {
      findMany: vi.fn(async () => usuarios.map((u) => conRol(u))),
      findUnique: vi.fn(async ({ where }: { where: Fila }) => conRol(buscarUsuario(where))),
      update: vi.fn(async ({ where, data }: { where: Fila; data: Fila }) => {
        const usuario = buscarUsuario(where)!;
        aplicar(usuario, data);
        return conRol(usuario);
      }),
    },
    refreshToken: {
      create: vi.fn(async ({ data }: { data: Fila }) => {
        const fila = { id: randomUUID(), revocadoEn: null, creadoEn: new Date(), ...data };
        refreshTokens.push(fila);
        return { ...fila };
      }),
      findUnique: vi.fn(async ({ where }: { where: Fila }) => {
        const fila = refreshTokens.find((r) => r.tokenHash === where.tokenHash);
        return fila ? { ...fila, usuario: conRol(usuarios.find((u) => u.id === fila.usuarioId)) } : null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Fila; data: Fila }) => {
        const filas = refreshTokens.filter((r) => coincide(r, where));
        filas.forEach((r) => aplicar(r, data));
        return { count: filas.length };
      }),
    },
    passwordResetToken: {
      create: vi.fn(async ({ data }: { data: Fila }) => {
        const fila = { id: randomUUID(), usado: false, creadoEn: new Date(), ...data };
        resetTokens.push(fila);
        return { ...fila };
      }),
      findUnique: vi.fn(async ({ where }: { where: Fila }) => {
        const fila = resetTokens.find((r) => r.token === where.token);
        return fila ? { ...fila, usuario: usuarios.find((u) => u.id === fila.usuarioId) } : null;
      }),
      findFirst: vi.fn(async ({ where }: { where: Fila }) => {
        const fila = resetTokens.find((r) => coincide(r, where));
        return fila ? { ...fila } : null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Fila; data: Fila }) => {
        const filas = resetTokens.filter((r) => coincide(r, where));
        filas.forEach((r) => aplicar(r, data));
        return { count: filas.length };
      }),
    },
    $transaction: vi.fn(async (arg: unknown): Promise<unknown> =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[]),
    ),
  };

  const agregarUsuario = (datos: Partial<Fila> & { email: string; passwordHash: string }) => {
    const usuario = {
      id: randomUUID(),
      rolId: ROL_ADMIN_ID,
      nombre: 'Mercedes',
      apellido: 'Ramírez',
      telefono: null,
      estado: 'activo',
      ultimoAcceso: null,
      tokenVersion: 0,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
      ...datos,
    };
    usuarios.push(usuario);
    return usuario;
  };

  return { prisma, usuarios, refreshTokens, resetTokens, agregarUsuario };
}
