import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVehicleDto } from '../vehiculos/dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from '../vehiculos/dto/update-vehicle.dto.js';

@Injectable()
export class VehiculosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createVehicleDto: CreateVehicleDto) {
    return await this.prisma.vehicle.create({
      data: createVehicleDto,
    });
  }

  async findAll() {
    return await this.prisma.vehicle.findMany({
      include: {
        clasificacion: true,
      },
    });
  }

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

  async update(id: number, updateVehicleDto: UpdateVehicleDto) {
    await this.findOne(id); // Verifica que exista
    return await this.prisma.vehicle.update({
      where: { idVehiculo: id },
      data: updateVehicleDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Verifica que exista
    return await this.prisma.vehicle.delete({
      where: { idVehiculo: id },
    });
  }
}