// Seed inicial: roles base y usuario administrador.
// Uso: pnpm db:seed  (lee SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD del .env)
import prismaPkg from '@prisma/client';
import bcrypt from 'bcrypt';

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const ROLES = [
  { nombre: 'Administrador', descripcion: 'Acceso total, incluida la gestión de usuarios' },
  { nombre: 'Supervisor', descripcion: 'Supervisión de flota, rutas y proformas' },
  { nombre: 'Operador', descripcion: 'Operación de patio, despacho y báscula' },
];

// Misma política que src/common/validators/password-policy.ts
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

const CONCEPTOS_RECARGOS = [
  { concepto: 'Pernocta en Hotel', tipoCalculo: 'Monto_Fijo', valor: 45.00 },
  { concepto: 'Tasa Portuaria', tipoCalculo: 'Monto_Fijo', valor: 120.00 },
  { concepto: 'Estacionamiento', tipoCalculo: 'Monto_Fijo', valor: 20.00 },
  { concepto: 'Caleta', tipoCalculo: 'Monto_Fijo', valor: 35.00 },
  { concepto: 'Viático de Conductor por Trayecto', tipoCalculo: 'Monto_Fijo', valor: 25.00 },
  { concepto: 'Otros Gastos', tipoCalculo: 'Monto_Fijo', valor: 25.00 },
];

async function main() {
  for (const rol of ROLES) {
    await prisma.role.upsert({ where: { nombre: rol.nombre }, update: {}, create: rol });
  }
  console.log(`Roles verificados: ${ROLES.map((r) => r.nombre).join(', ')}`);

  for (const item of CONCEPTOS_RECARGOS) {
    const exist = await prisma.recargoGeneral.findFirst({
      where: { concepto: item.concepto },
    });
    if (!exist) {
      await prisma.recargoGeneral.create({
        data: {
          concepto: item.concepto,
          tipoCalculo: item.tipoCalculo,
          valor: item.valor,
        },
      });
    }
  }
  console.log('Conceptos de recargos_generales verificados.');

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('Defina SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD para crear el administrador inicial.');
    return;
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new Error(
      'SEED_ADMIN_PASSWORD debe tener 8-64 caracteres con mayúscula, minúscula, número y carácter especial',
    );
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`El usuario ${email} ya existe; no se modifica.`);
    return;
  }

  const rolAdmin = await prisma.role.findUniqueOrThrow({ where: { nombre: 'Administrador' } });
  await prisma.usuario.create({
    data: {
      email,
      nombre: process.env.SEED_ADMIN_NOMBRE ?? 'Administrador',
      apellido: process.env.SEED_ADMIN_APELLIDO ?? 'FleetFlow',
      passwordHash: await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS ?? 12)),
      rolId: rolAdmin.id,
    },
  });
  console.log(`Administrador ${email} creado. Elimine SEED_ADMIN_PASSWORD del .env.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
