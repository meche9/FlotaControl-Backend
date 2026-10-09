import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImagenesService, type ArchivoImagen } from '../imagenes/imagenes.service.js';
import { CreateVehicleDto } from '../vehiculos/dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from '../vehiculos/dto/update-vehicle.dto.js';

@Injectable()
export class VehiculosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagenes: ImagenesService,
  ) { }

  private manejarErrorPrisma(error: unknown, dto?: Partial<CreateVehicleDto>): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = String(error.meta?.target ?? '');
        if (target.includes('placa')) {
          const placa = dto?.placa ? ` '${dto.placa}'` : '';
          throw new ConflictException(`Ya existe un vehículo registrado con la placa${placa}. Por favor, verifique la matrícula.`);
        }
        if (target.includes('chasis') || target.includes('numeroChasis')) {
          const chasis = dto?.numeroChasis ? ` '${dto.numeroChasis}'` : '';
          throw new ConflictException(`Ya existe un vehículo registrado con el número de chasis (VIN)${chasis}.`);
        }
        if (target.includes('motor') || target.includes('numeroMotor')) {
          const motor = dto?.numeroMotor ? ` '${dto.numeroMotor}'` : '';
          throw new ConflictException(`Ya existe un vehículo registrado con el número de motor${motor}.`);
        }
        if (target.includes('acoplado')) {
          throw new ConflictException('El acoplado seleccionado ya se encuentra asignado a otra unidad motora.');
        }
        throw new ConflictException('Ya existe un vehículo con estos datos únicos en el sistema.');
      }

      if (error.code === 'P2003') {
        const field = String(error.meta?.field_name ?? '');
        if (field.includes('id_clasificacion') || field.includes('clasificacion')) {
          throw new BadRequestException('La clasificación de vehículo seleccionada no es válida o no existe en el sistema.');
        }
        if (field.includes('id_acoplado_actual') || field.includes('acoplado')) {
          throw new BadRequestException('El acoplado asociado seleccionado no existe en el sistema.');
        }
        throw new BadRequestException('Error de integridad referencial: uno de los registros relacionados no existe en el sistema.');
      }
    }
    throw error;
  }

  //Crear un vehiculo
  async create(createVehicleDto: CreateVehicleDto) {
    try {
      return await this.prisma.vehicle.create({
        data: createVehicleDto,
        include: {
          clasificacion: {
            include: {
              tipo: true,
            },
          },
          conductoresHabituales: true,
        },
      });
    } catch (error) {
      this.manejarErrorPrisma(error, createVehicleDto);
    }
  }

  //Buscar todos los vehiculos
  async findAll() {
    return await this.prisma.vehicle.findMany({
      include: {
        clasificacion: {
          include: {
            tipo: true,
          },
        },
        conductoresHabituales: true,
      },
    });
  }

  //Buscar todos los tipos de vehículos
  async findTipos() {
    return await this.prisma.tipoVehiculo.findMany({
      where: { activo: true },
      include: {
        clasificaciones: true,
      },
    });
  }

  //Buscar todas las clasificaciones de vehículos
  async findClasificaciones() {
    return await this.prisma.clasificacionVehiculo.findMany({
      where: { activo: true },
      include: {
        tipo: true,
      },
    });
  }

  //Buscar vehiculo por placa
  async findOneByPlaca(placa: string) {
    const vehiculo = await this.prisma.vehicle.findUnique({
      where: { placa },
      include: {
        clasificacion: {
          include: {
            tipo: true,
          },
        },
        vehiculosAcoplados: true
      },
    });
    if (!vehiculo) {
      throw new NotFoundException(`No se encontró ningún vehículo con la placa ${placa}`);
    }
    return vehiculo;
  }

  //Buscar vehiculo por id
  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { idVehiculo: id },
      include: {
        clasificacion: {
          include: {
            tipo: true,
          },
        },
        vehiculosAcoplados: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehículo con ID ${id} no encontrado`);
    }

    return vehicle;
  }

  //Actualizar datos de un vehiculo
  async update(id: string, updateVehicleDto: UpdateVehicleDto) {
    // 1. Verificamos si el vehículo existe (lanza error 404 si no)
    await this.findOne(id);

    // 2. Actualizamos en la base de datos
    try {
      return await this.prisma.vehicle.update({
        where: { idVehiculo: id },
        data: updateVehicleDto,
        include: {
          clasificacion: {
            include: {
              tipo: true,
            },
          },
          conductoresHabituales: true,
        },
      });
    } catch (error) {
      this.manejarErrorPrisma(error, updateVehicleDto);
    }
  }

  //Eliminar un vehiculo
  async remove(id: string) {
    const vehiculo = await this.findOne(id); // Verifica que exista
    const eliminado = await this.prisma.vehicle.delete({
      where: { idVehiculo: id },
    });
    await this.imagenes.eliminar('vehiculos', vehiculo.foto);
    return eliminado;
  }

  async actualizarFoto(id: string, archivo: ArchivoImagen | undefined) {
    const vehiculo = await this.findOne(id);
    const foto = await this.imagenes.guardar('vehiculos', archivo);

    try {
      const actualizado = await this.prisma.vehicle.update({
        where: { idVehiculo: id },
        data: { foto },
        include: {
          clasificacion: {
            include: {
              tipo: true,
            },
          },
        },
      });
      await this.imagenes.eliminar('vehiculos', vehiculo.foto);
      return actualizado;
    } catch (error) {
      await this.imagenes.eliminar('vehiculos', foto);
      throw error;
    }
  }

  async obtenerFoto(id: string) {
    const vehiculo = await this.findOne(id);
    return this.imagenes.obtener('vehiculos', vehiculo.foto);
  }

  async eliminarFoto(id: string) {
    const vehiculo = await this.findOne(id);
    const actualizado = await this.prisma.vehicle.update({
      where: { idVehiculo: id },
      data: { foto: null },
      include: {
        clasificacion: {
          include: {
            tipo: true,
          },
        },
      },
    });
    await this.imagenes.eliminar('vehiculos', vehiculo.foto);
    return actualizado;
  }
}
