import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateRutaPeajeDto } from './dto/create-ruta-peaje.dto.js';
import { UpdateRutaPeajeDto } from './dto/update-ruta-peaje.dto.js';
import { ItemRutaPeajeDto } from './dto/sync-ruta-peajes.dto.js';

@Injectable()
export class PeajesService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Obtener catálogo nacional de peajes (peajes_vzla)
  async getCatalogoVzla() {
    return await this.prisma.peajeVzla.findMany({
      where: { activo: true },
      orderBy: [
        { estadoUbicacion: 'asc' },
        { nombrePeaje: 'asc' },
      ],
    });
  }

  // 2. Obtener peajes asignados a una ruta
  async findByRuta(idRuta: string) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
      select: { idRuta: true, nombreRuta: true },
    });

    if (!ruta) {
      throw new NotFoundException(`Ruta con ID ${idRuta} no fue encontrada.`);
    }

    return await this.prisma.rutaPeaje.findMany({
      where: { idRuta },
      orderBy: { orden: 'asc' },
    });
  }

  // 3. Crear peaje individual para una ruta
  async create(dto: CreateRutaPeajeDto) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta: dto.idRuta },
    });
    if (!ruta) {
      throw new NotFoundException(`Ruta con ID ${dto.idRuta} no fue encontrada.`);
    }

    return await this.prisma.rutaPeaje.create({
      data: {
        idRuta: dto.idRuta,
        nombrePeaje: dto.nombrePeaje.trim(),
        ubicacion: dto.ubicacion?.trim() || null,
        orden: dto.orden ?? 1,
        costo: dto.costo ?? 0,
        activo: dto.activo ?? true,
      },
    });
  }

  // 4. Sincronización / Asignación en lote de peajes para una ruta
  async syncPeajesRuta(idRuta: string, peajes: ItemRutaPeajeDto[]) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
    });
    if (!ruta) {
      throw new NotFoundException(`Ruta con ID ${idRuta} no fue encontrada.`);
    }

    // En transacción: eliminar peajes anteriores de la ruta e insertar los seleccionados
    return await this.prisma.$transaction(async (tx) => {
      await tx.rutaPeaje.deleteMany({
        where: { idRuta },
      });

      if (peajes.length > 0) {
        await tx.rutaPeaje.createMany({
          data: peajes.map((p, idx) => ({
            idRuta,
            nombrePeaje: p.nombrePeaje.trim(),
            ubicacion: p.ubicacion?.trim() || null,
            orden: p.orden ?? (idx + 1),
            costo: p.costo ?? 0,
            activo: p.activo ?? true,
          })),
        });
      }

      return await tx.rutaPeaje.findMany({
        where: { idRuta },
        orderBy: { orden: 'asc' },
      });
    });
  }

  // 5. Obtener un peaje asignado específico por ID
  async findOne(id: string) {
    const peaje = await this.prisma.rutaPeaje.findUnique({
      where: { idRutaPeaje: id },
    });
    if (!peaje) {
      throw new NotFoundException(`Peaje asignado con ID ${id} no fue encontrado.`);
    }
    return peaje;
  }

  // 6. Actualizar peaje asignado
  async update(id: string, dto: UpdateRutaPeajeDto) {
    await this.findOne(id);

    return await this.prisma.rutaPeaje.update({
      where: { idRutaPeaje: id },
      data: {
        ...(dto.nombrePeaje && { nombrePeaje: dto.nombrePeaje.trim() }),
        ...(dto.ubicacion !== undefined && { ubicacion: dto.ubicacion?.trim() || null }),
        ...(dto.orden !== undefined && { orden: dto.orden }),
        ...(dto.costo !== undefined && { costo: dto.costo }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
  }

  // 7. Eliminar peaje asignado
  async remove(id: string) {
    await this.findOne(id);
    return await this.prisma.rutaPeaje.delete({
      where: { idRutaPeaje: id },
    });
  }
}
