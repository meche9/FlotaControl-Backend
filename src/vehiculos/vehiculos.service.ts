import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVehicleDto } from '../vehiculos/dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from '../vehiculos/dto/update-vehicle.dto.js';

@Injectable()
export class VehiculosService {
  constructor(private readonly prisma: PrismaService) { }



  //Crear un vehiculo
  async create(createVehicleDto: CreateVehicleDto) {
    return await this.prisma.vehicle.create({
      data: createVehicleDto,
    });
  }

  //Buscar todos los vehiculos
  async findAll() {
    return await this.prisma.vehicle.findMany({
      include: {
        clasificacion: true,
      },
    });
  }


  //Buscar vehiculo por placa
  async findOneByPlaca(placa: string) {
    const vehiculo = await this.prisma.vehicle.findUnique({
      where: { placa },
      include: {
        clasificacion: true, // Para traer también su clasificación relacionada
        vehiculosAcoplados: true
      },
    });
    if (!vehiculo) {
      throw new NotFoundException(`No se encontró ningún vehículo con la placa ${placa}`);
    }
    return vehiculo;
  }

  //Buscar vehiculo por id
  async findOne(id: number) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { idVehiculo: id },
      include: {
        clasificacion: true,
        vehiculosAcoplados: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehículo con ID ${id} no encontrado`);
    }

    return vehicle;
  }


  //Actualizar datos de un vehiculo
  async update(id: number, updateVehicleDto: UpdateVehicleDto) {
    // 1. Verificamos si el vehículo existe (lanza error 404 si no)
    await this.findOne(id);

    // 2. Actualizamos en la base de datos
    return await this.prisma.vehicle.update({
      where: { idVehiculo: id },
      data: updateVehicleDto,
    });
  }




  //Eliminar un vehiculo
  async remove(id: number) {
    await this.findOne(id); // Verifica que exista
    return await this.prisma.vehicle.delete({
      where: { idVehiculo: id },
    });
  }
}