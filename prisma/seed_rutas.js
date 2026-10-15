import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

async function seedRutas() {
  const polar = await prisma.cliente.findFirst({
    where: {
      OR: [
        { rif: { contains: '00006372' } },
        { razonSocial: { contains: 'Polar' } }
      ]
    }
  });

  if (!polar) {
    console.log('Cliente Polar no encontrado');
    return;
  }
  console.log('Cliente Polar ID:', polar.idCliente);

  const puntosData = [
    { nombreSede: 'Planta San Joaquín - Silos Sur (Carabobo)', ciudad: 'San Joaquín', estado: 'Carabobo', direccion: 'Zona Industrial San Joaquín, Carretera Nacional' },
    { nombreSede: 'C.D. Los Cortijos - Andén Central (Miranda)', ciudad: 'Caracas', estado: 'Miranda', direccion: 'Av. Diego Cisneros, Los Cortijos de Lourdes' },
    { nombreSede: 'C.D. Turmero', ciudad: 'Turmero', estado: 'Aragua', direccion: 'Intercomunal Santiago Mariño, Turmero' },
    { nombreSede: 'C.D. Barquisimeto', ciudad: 'Barquisimeto', estado: 'Lara', direccion: 'Zona Industrial II, Carrera 2' },
    { nombreSede: 'C.D. Guarenas', ciudad: 'Guarenas', estado: 'Miranda', direccion: 'Zona Industrial Maturín, Guarenas' }
  ];

  const puntosMap = {};
  for (const p of puntosData) {
    let exist = await prisma.puntoCargaDescarga.findFirst({
      where: { idCliente: polar.idCliente, nombreSede: p.nombreSede }
    });
    if (!exist) {
      exist = await prisma.puntoCargaDescarga.create({
        data: {
          idCliente: polar.idCliente,
          nombreSede: p.nombreSede,
          ciudad: p.ciudad,
          estado: p.estado,
          direccion: p.direccion,
          tipoPunto: 'Ambos',
          activo: true
        }
      });
      console.log('Punto creado:', p.nombreSede, exist.idPunto);
    }
    puntosMap[p.nombreSede] = exist.idPunto;
  }

  const rutasData = [
    {
      nombreRuta: 'Ruta Troncal ARC: Planta San Joaquín — C.D. Los Cortijos',
      ciudadOrigen: 'San Joaquín, Carabobo',
      ciudadDestino: 'Caracas, Miranda',
      idPuntoOrigen: puntosMap['Planta San Joaquín - Silos Sur (Carabobo)'],
      idPuntoDestino: puntosMap['C.D. Los Cortijos - Andén Central (Miranda)'],
      distanciaKm: 158.40,
      tiempoEstimadoHoras: 3.5,
      consumoEstimadoGasoil: 66.500000,
      activo: true
    },
    {
      nombreRuta: 'Ruta Regional Centro: Planta San Joaquín — C.D. Turmero',
      ciudadOrigen: 'San Joaquín, Carabobo',
      ciudadDestino: 'Turmero, Aragua',
      idPuntoOrigen: puntosMap['Planta San Joaquín - Silos Sur (Carabobo)'],
      idPuntoDestino: puntosMap['C.D. Turmero'],
      distanciaKm: 64.20,
      tiempoEstimadoHoras: 1.4,
      consumoEstimadoGasoil: 28.100000,
      activo: true
    },
    {
      nombreRuta: 'Ruta Occidente Troncal 11: Planta San Joaquín — C.D. Barquisimeto',
      ciudadOrigen: 'San Joaquín, Carabobo',
      ciudadDestino: 'Barquisimeto, Lara',
      idPuntoOrigen: puntosMap['Planta San Joaquín - Silos Sur (Carabobo)'],
      idPuntoDestino: puntosMap['C.D. Barquisimeto'],
      distanciaKm: 172.10,
      tiempoEstimadoHoras: 3.8,
      consumoEstimadoGasoil: 74.300000,
      activo: true
    },
    {
      nombreRuta: 'Ruta Interurbana Gran Caracas: C.D. Los Cortijos — C.D. Guarenas',
      ciudadOrigen: 'Caracas, Miranda',
      ciudadDestino: 'Guarenas, Miranda',
      idPuntoOrigen: puntosMap['C.D. Los Cortijos - Andén Central (Miranda)'],
      idPuntoDestino: puntosMap['C.D. Guarenas'],
      distanciaKm: 38.50,
      tiempoEstimadoHoras: 1.1,
      consumoEstimadoGasoil: 16.200000,
      activo: false
    }
  ];

  for (const r of rutasData) {
    const exist = await prisma.ruta.findFirst({
      where: { idCliente: polar.idCliente, nombreRuta: r.nombreRuta }
    });
    if (!exist) {
      const created = await prisma.ruta.create({
        data: {
          idCliente: polar.idCliente,
          nombreRuta: r.nombreRuta,
          ciudadOrigen: r.ciudadOrigen,
          ciudadDestino: r.ciudadDestino,
          idPuntoOrigen: r.idPuntoOrigen,
          idPuntoDestino: r.idPuntoDestino,
          distanciaKm: r.distanciaKm,
          tiempoEstimadoHoras: r.tiempoEstimadoHoras,
          consumoEstimadoGasoil: r.consumoEstimadoGasoil,
          activo: r.activo
        }
      });
      console.log('Ruta creada:', created.nombreRuta, created.idRuta);
    }
  }

  const count = await prisma.ruta.count();
  console.log('Total rutas ahora en DB:', count);
}

seedRutas()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
