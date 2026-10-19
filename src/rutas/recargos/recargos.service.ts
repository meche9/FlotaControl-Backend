import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateRutaRecargoDto } from './dto/create-ruta-recargo.dto.js';
import { UpdateRutaRecargoDto } from './dto/update-ruta-recargo.dto.js';
import { ItemRutaRecargoDto } from './dto/sync-ruta-recargos.dto.js';
import { RecargoTipoCalculo } from '@prisma/client';

@Injectable()
export class RecargosService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Obtener catálogo general de recargos (recargos_generales)
  async getCatalogoGenerales() {
    return await this.prisma.recargoGeneral.findMany({
      orderBy: { concepto: 'asc' },
    });
  }

  // 2. Obtener recargos asignados a una ruta específica (rutas_recargos)
  async findByRuta(idRuta: string) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
      select: { idRuta: true, nombreRuta: true },
    });

    if (!ruta) {
      throw new NotFoundException(`Ruta con ID ${idRuta} no fue encontrada.`);
    }

    return await this.prisma.rutaRecargo.findMany({
      where: { idRuta },
      orderBy: { concepto: 'asc' },
    });
  }

  // 3. Crear recargo individual para una ruta
  async create(dto: CreateRutaRecargoDto) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta: dto.idRuta },
    });
    if (!ruta) {
      throw new NotFoundException(`Ruta con ID ${dto.idRuta} no fue encontrada.`);
    }

    return await this.prisma.rutaRecargo.create({
      data: {
        idRuta: dto.idRuta,
        concepto: dto.concepto.trim(),
        tipoCalculo: dto.tipoCalculo ?? RecargoTipoCalculo.Monto_Fijo,
        valor: dto.valor ?? 0,
      },
    });
  }

  // 4. Sincronización / Asignación en lote de recargos para una ruta
  async syncRecargosRuta(idRuta: string, recargos: ItemRutaRecargoDto[]) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
    });
    if (!ruta) {
      throw new NotFoundException(`Ruta con ID ${idRuta} no fue encontrada.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.rutaRecargo.deleteMany({
        where: { idRuta },
      });

      if (recargos.length > 0) {
        await tx.rutaRecargo.createMany({
          data: recargos.map((r) => ({
            idRuta,
            concepto: r.concepto.trim(),
            tipoCalculo: r.tipoCalculo ?? RecargoTipoCalculo.Monto_Fijo,
            valor: r.valor ?? 0,
          })),
        });
      }

      return await tx.rutaRecargo.findMany({
        where: { idRuta },
        orderBy: { concepto: 'asc' },
      });
    });
  }

  // 5. Obtener un recargo asignado específico por ID
  async findOne(id: string) {
    const recargo = await this.prisma.rutaRecargo.findUnique({
      where: { idRecargo: id },
    });
    if (!recargo) {
      throw new NotFoundException(`Recargo asignado con ID ${id} no fue encontrado.`);
    }
    return recargo;
  }

  // 6. Actualizar recargo asignado
  async update(id: string, dto: UpdateRutaRecargoDto) {
    await this.findOne(id);

    return await this.prisma.rutaRecargo.update({
      where: { idRecargo: id },
      data: {
        ...(dto.concepto && { concepto: dto.concepto.trim() }),
        ...(dto.tipoCalculo && { tipoCalculo: dto.tipoCalculo }),
        ...(dto.valor !== undefined && { valor: dto.valor }),
      },
    });
  }

  // 7. Eliminar recargo asignado
  async remove(id: string) {
    await this.findOne(id);
    return await this.prisma.rutaRecargo.delete({
      where: { idRecargo: id },
    });
  }
}
