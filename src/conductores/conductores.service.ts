import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImagenesService, type ArchivoImagen } from '../imagenes/imagenes.service.js';
import { CreateConductorDto } from './dto/create-conductores.dto.js';
import { UpdateConductorDto } from './dto/update-conductores.dto.js';

@Injectable()
export class ConductoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagenes: ImagenesService,
  ) {}

  // 1. Crear un conductor
  async create(createConductorDto: CreateConductorDto) {
    const { fechaNacimiento, fechaIngreso, idVehiculoHabitual, ...resto } = createConductorDto;
    return await this.prisma.conductor.create({
      data: {
        ...resto,
        idVehiculoHabitual:
          idVehiculoHabitual && idVehiculoHabitual.trim() !== '' ? idVehiculoHabitual.trim() : null,
        fechaNacimiento:
          fechaNacimiento && fechaNacimiento.trim() !== '' ? new Date(fechaNacimiento.trim()) : null,
        fechaIngreso:
          fechaIngreso && fechaIngreso.trim() !== '' ? new Date(fechaIngreso.trim()) : null,
      },
      include: {
        vehiculoHabitual: {
          include: {
            clasificacion: true,
          },
        },
      },
    });
  }

  // 2. Listar todos los conductores (con su vehículo habitual si lo tiene)
  async findAll() {
    return await this.prisma.conductor.findMany({
      include: {
        vehiculoHabitual: {
          include: {
            clasificacion: true,
          },
        },
      },
      orderBy: {
        fechaCreacion: 'desc',
      },
    });
  }

  // 3. Buscar un conductor por su ID
  async findOne(id: string) {
    const conductor = await this.prisma.conductor.findUnique({
      where: { idConductor: id },
      include: {
        vehiculoHabitual: {
          include: {
            clasificacion: true,
          },
        },
      },
    });

    if (!conductor) {
      throw new NotFoundException(`No se encontró el conductor con el ID ${id}`);
    }

    return conductor;
  }

  // 4. Buscar un conductor por su cédula de identidad
  async findByCedula(cedulaIdentidad: string) {
    const conductor = await this.prisma.conductor.findUnique({
      where: { cedulaIdentidad },
      include: {
        vehiculoHabitual: {
          include: {
            clasificacion: true,
          },
        },
      },
    });

    if (!conductor) {
      throw new NotFoundException(`No se encontró ningún conductor con la cédula ${cedulaIdentidad}`);
    }

    return conductor;
  }

  // 5. Actualizar un conductor
  async update(id: string, updateConductorDto: UpdateConductorDto) {
    await this.findOne(id);

    const { fechaNacimiento, fechaIngreso, idVehiculoHabitual, ...resto } = updateConductorDto;
    const dataToUpdate: Record<string, any> = {};

    for (const [key, value] of Object.entries(resto)) {
      if (value !== undefined) {
        if (typeof value === 'string') {
          dataToUpdate[key] = value.trim() === '' ? null : value.trim();
        } else {
          dataToUpdate[key] = value;
        }
      }
    }

    if (idVehiculoHabitual !== undefined) {
      dataToUpdate.idVehiculoHabitual =
        typeof idVehiculoHabitual === 'string' && idVehiculoHabitual.trim() !== ''
          ? idVehiculoHabitual.trim()
          : null;
    }

    if (fechaNacimiento !== undefined) {
      dataToUpdate.fechaNacimiento =
        typeof fechaNacimiento === 'string' && fechaNacimiento.trim() !== ''
          ? new Date(fechaNacimiento.trim())
          : null;
    }

    if (fechaIngreso !== undefined) {
      dataToUpdate.fechaIngreso =
        typeof fechaIngreso === 'string' && fechaIngreso.trim() !== ''
          ? new Date(fechaIngreso.trim())
          : null;
    }

    return await this.prisma.conductor.update({
      where: { idConductor: id },
      data: dataToUpdate,
      include: {
        vehiculoHabitual: {
          include: {
            clasificacion: true,
          },
        },
      },
    });
  }

  // 6. Eliminar un conductor
  async remove(id: string) {
    const conductor = await this.findOne(id);

    const eliminado = await this.prisma.conductor.delete({
      where: { idConductor: id },
    });

    if (conductor.foto) {
      await this.imagenes.eliminar('conductores', conductor.foto);
    }

    return eliminado;
  }

  // 7. Actualizar Foto de Perfil del Conductor
  async actualizarFoto(id: string, archivo: ArchivoImagen | undefined) {
    const conductor = await this.findOne(id);
    const foto = await this.imagenes.guardar('conductores', archivo);

    try {
      const actualizado = await this.prisma.conductor.update({
        where: { idConductor: id },
        data: { foto },
        include: {
          vehiculoHabitual: {
            include: {
              clasificacion: true,
            },
          },
        },
      });

      if (conductor.foto) {
        await this.imagenes.eliminar('conductores', conductor.foto);
      }

      return actualizado;
    } catch (error) {
      await this.imagenes.eliminar('conductores', foto);
      throw error;
    }
  }

  // 8. Obtener Foto del Conductor
  async obtenerFoto(id: string) {
    const conductor = await this.findOne(id);
    return this.imagenes.obtener('conductores', conductor.foto);
  }

  // 9. Eliminar Foto del Conductor
  async eliminarFoto(id: string) {
    const conductor = await this.findOne(id);
    const actualizado = await this.prisma.conductor.update({
      where: { idConductor: id },
      data: { foto: null },
      include: {
        vehiculoHabitual: {
          include: {
            clasificacion: true,
          },
        },
      },
    });

    if (conductor.foto) {
      await this.imagenes.eliminar('conductores', conductor.foto);
    }

    return actualizado;
  }
}