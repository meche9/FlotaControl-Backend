import prismaPkg from '@prisma/client';
import bcrypt from 'bcrypt';

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const PASSWORD = 'admin123';

async function main() {
  const rolAdmin = await prisma.role.findFirst({
    where: { nombre: 'Administrador' }
  });

  if (!rolAdmin) {
    throw new Error('No se encontró el rol Administrador');
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const admins = [
    {
      email: 'admin@fleetflow.com',
      nombre: 'Administrador',
      apellido: 'FleetFlow',
    },
    {
      email: 'superadmin@fleetflow.com',
      nombre: 'Mercedes',
      apellido: 'Rodriguez',
    },
    {
      email: 'admin@flotacontrol.com',
      nombre: 'Administrador',
      apellido: 'FlotaControl',
    },
    {
      email: 'mmrr28empresa@gmail.com',
      nombre: 'Mercedes',
      apellido: 'Rodriguez',
    },
    {
      email: 'armandocamposf@gmail.com',
      nombre: 'Armando',
      apellido: 'Campos',
    }
  ];

  for (const admin of admins) {
    const usuario = await prisma.usuario.upsert({
      where: { email: admin.email },
      update: {
        passwordHash,
        rolId: rolAdmin.id,
        estado: 'activo',
        tokenVersion: 0,
      },
      create: {
        email: admin.email,
        nombre: admin.nombre,
        apellido: admin.apellido,
        passwordHash,
        rolId: rolAdmin.id,
        estado: 'activo',
      },
    });
    console.log(`Usuario creado/actualizado: ${usuario.email} (ID: ${usuario.id})`);
  }

  const allRoles = await prisma.role.findMany();
  console.log('ROLES EN BD:', allRoles);

  const allUsers = await prisma.usuario.findMany({ include: { rol: true } });
  console.log('USUARIOS EN BD:', allUsers.map(u => ({ id: u.id, email: u.email, nombre: u.nombre, rol: u.rol.nombre })));

  console.log(`\nContraseña configurada: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('Error creando usuarios:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
