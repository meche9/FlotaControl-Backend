import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateConductorDto } from './dto/create-conductores.dto.js';
import { UpdateConductorDto } from './dto/update-conductores.dto.js';

@Injectable()

export class ConductoresService{
constructor(private readonly prisma: PrismaService) {}


  //Crear un conductor
  async create(createConductorDto: CreateConductorDto) {
    return await this.prisma.conductor.create({
      data: createConductorDto,
    });
  };


// 2. Listar todos los conductores (con su vehículo habitual si lo tiene)
  async findAll() {
    return await this.prisma.conductor.findMany({
      include: {
        vehiculoHabitual: {
          include: {
            clasificacion: true, // Opcional: trae también la clasificación del vehículo habitual
          },
        },
      },
    });
  }

  // 3. Buscar un conductor por su ID (Reutilizable para actualizar/eliminar)
  async findOne(id: string) {
    const conductor = await this.prisma.conductor.findUnique({
      where: { idConductor: id },
      include: {
        vehiculoHabitual: true,
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
        vehiculoHabitual: true,
      },
    });

    if (!conductor) {
      throw new NotFoundException(`No se encontró ningún conductor con la cédula ${cedulaIdentidad}`);
    }

    return conductor;
  }

  // 5. Actualizar un conductor
  async update(id: string, updateConductorDto: UpdateConductorDto) {
    // Verificamos que exista antes de actualizar (lanza 404 si no existe)
    await this.findOne(id);

    return await this.prisma.conductor.update({
      where: { idConductor: id },
      data: updateConductorDto,
    });
  }

  // 6. Eliminar un conductor
  async remove(id: string) {
    // Verificamos que exista antes de eliminar
    await this.findOne(id);

    return await this.prisma.conductor.delete({
      where: { idConductor: id },
    });
  }
}