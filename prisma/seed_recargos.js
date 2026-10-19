import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const CONCEPTOS_RECARGOS = [
  { concepto: 'Pernocta en Hotel', tipoCalculo: 'Monto_Fijo', valor: 45.00 },
  { concepto: 'Tasa Portuaria', tipoCalculo: 'Monto_Fijo', valor: 120.00 },
  { concepto: 'Estacionamiento', tipoCalculo: 'Monto_Fijo', valor: 20.00 },
  { concepto: 'Caleta', tipoCalculo: 'Monto_Fijo', valor: 35.00 },
  { concepto: 'Viático de Conductor por Trayecto', tipoCalculo: 'Monto_Fijo', valor: 25.00 },
  { concepto: 'Otros Gastos', tipoCalculo: 'Monto_Fijo', valor: 25.00 },
];

async function seedRecargosGenerales() {
  console.log('--- Iniciando inserción de conceptos en recargos_generales ---');
  for (const item of CONCEPTOS_RECARGOS) {
    const exist = await prisma.recargoGeneral.findFirst({
      where: { concepto: item.concepto },
    });

    if (!exist) {
      const created = await prisma.recargoGeneral.create({
        data: {
          concepto: item.concepto,
          tipoCalculo: item.tipoCalculo,
          valor: item.valor,
        },
      });
      console.log(`[CREADO] ${created.concepto} - Tipo: ${created.tipoCalculo} - Valor: ${created.valor}`);
    } else {
      console.log(`[YA EXISTE] ${item.concepto}`);
    }
  }

  const all = await prisma.recargoGeneral.findMany();
  console.log(`Total recargos generales en DB: ${all.length}`);
}

seedRecargosGenerales()
  .catch((e) => {
    console.error('Error al poblar recargos_generales:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
