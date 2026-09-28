// Prisma en memoria para pruebas unitarias del módulo de autenticación.
// Implementa solo las operaciones que usan AuthService y JwtAuthGuard.
import { vi } from 'vitest';

type Fila = Record<string, any>;

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
  let secuencia = 1;
  const roles: Fila[] = [
    { id: 1, nombre: 'Administrador', descripcion: 'Acceso total', creadoEn: new Date() },
    { id: 2, nombre: 'Operador', descripcion: null, creadoEn: new Date() },
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
        const fila = { id: secuencia++, revocadoEn: null, creadoEn: new Date(), ...data };
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
        const fila = { id: secuencia++, usado: false, creadoEn: new Date(), ...data };
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
      id: secuencia++,
      rolId: 1,
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
