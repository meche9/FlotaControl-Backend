import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, RutaTipoCobro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRutaDto } from './dto/create-ruta.dto.js';
import { UpdateRutaDto } from './dto/update-ruta.dto.js';

@Injectable()
export class RutasService {
  constructor(private readonly prisma: PrismaService) {}

  private manejarErrorPrisma(error: unknown, dto?: Partial<CreateRutaDto>): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const rutaMsg = dto?.nombreRuta ? ` '${dto.nombreRuta}'` : '';
        throw new ConflictException(`Ya existe una ruta registrada con el nombre${rutaMsg}.`);
      }

      if (error.code === 'P2003') {
        const metaStr = JSON.stringify(error.meta ?? {});
        if (metaStr.includes('id_cliente') || metaStr.includes('cliente')) {
          throw new BadRequestException('El cliente seleccionado no es válido o no existe.');
        }
        if (metaStr.includes('id_punto_origen') || metaStr.includes('punto_origen')) {
          throw new BadRequestException('El punto de origen seleccionado no es válido o no existe.');
        }
        if (metaStr.includes('id_punto_destino') || metaStr.includes('punto_destino')) {
          throw new BadRequestException('El punto de destino seleccionado no es válido o no existe.');
        }
        throw new BadRequestException(
          'Error de integridad referencial: la ruta no puede ser procesada o eliminada debido a registros vinculados (guías de viaje).',
        );
      }
    }
    throw error;
  }

  private async validarRelaciones(
    idCliente: string,
    idPuntoOrigen?: string | null,
    idPuntoDestino?: string | null,
  ) {
    // 1. Validar que el cliente exista
    const cliente = await this.prisma.cliente.findUnique({
      where: { idCliente },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${idCliente} no fue encontrado.`);
    }

    // 2. Validar punto de origen si fue suministrado
    if (idPuntoOrigen) {
      const puntoOrigen = await this.prisma.puntoCargaDescarga.findUnique({
        where: { idPunto: idPuntoOrigen },
      });
      if (!puntoOrigen) {
        throw new NotFoundException(
          `Punto de carga/descarga de origen con ID ${idPuntoOrigen} no fue encontrado.`,
        );
      }
      if (puntoOrigen.idCliente !== idCliente) {
        throw new BadRequestException(
          'El punto de origen seleccionado no pertenece al cliente especificado.',
        );
      }
    }

    // 3. Validar punto de destino si fue suministrado
    if (idPuntoDestino) {
      const puntoDestino = await this.prisma.puntoCargaDescarga.findUnique({
        where: { idPunto: idPuntoDestino },
      });
      if (!puntoDestino) {
        throw new NotFoundException(
          `Punto de carga/descarga de destino con ID ${idPuntoDestino} no fue encontrado.`,
        );
      }
      if (puntoDestino.idCliente !== idCliente) {
        throw new BadRequestException(
          'El punto de destino seleccionado no pertenece al cliente especificado.',
        );
      }
    }

    // 4. Validar que origen y destino no sean el mismo punto físico
    if (idPuntoOrigen && idPuntoDestino && idPuntoOrigen === idPuntoDestino) {
      throw new BadRequestException(
        'El punto de origen y el punto de destino no pueden ser el mismo.',
      );
    }
  }

  // 1. Crear una nueva ruta
  async create(createRutaDto: CreateRutaDto) {
    const idPuntoOrigen =
      createRutaDto.idPuntoOrigen && createRutaDto.idPuntoOrigen.trim() !== ''
        ? createRutaDto.idPuntoOrigen.trim()
        : null;

    const idPuntoDestino =
      createRutaDto.idPuntoDestino && createRutaDto.idPuntoDestino.trim() !== ''
        ? createRutaDto.idPuntoDestino.trim()
        : null;

    await this.validarRelaciones(createRutaDto.idCliente, idPuntoOrigen, idPuntoDestino);

    try {
      return await this.prisma.ruta.create({
        data: {
          idCliente: createRutaDto.idCliente,
          nombreRuta: createRutaDto.nombreRuta.trim(),
          ciudadOrigen: createRutaDto.ciudadOrigen.trim(),
          ciudadDestino: createRutaDto.ciudadDestino.trim(),
          idPuntoOrigen,
          idPuntoDestino,
          distanciaKm: createRutaDto.distanciaKm ?? 0,
          tiempoEstimadoHoras: createRutaDto.tiempoEstimadoHoras ?? null,
          consumoEstimadoGasoil: createRutaDto.consumoEstimadoGasoil ?? 0,
          montoTarifa: createRutaDto.montoTarifa ?? 0,
          tipoCobro: createRutaDto.tipoCobro ?? RutaTipoCobro.Por_Viaje_Fijo,
          moneda: createRutaDto.moneda?.trim() || 'USD',
          activo: createRutaDto.activo ?? true,
        },
        include: {
          cliente: {
            select: {
              idCliente: true,
              razonSocial: true,
              nombreComercial: true,
              rif: true,
            },
          },
          puntoOrigen: {
            select: {
              idPunto: true,
              codigoPuntoc: true,
              nombreSede: true,
              ciudad: true,
              estado: true,
              direccion: true,
            },
          },
          puntoDestino: {
            select: {
              idPunto: true,
              codigoPuntoc: true,
              nombreSede: true,
              ciudad: true,
              estado: true,
              direccion: true,
            },
          },
          _count: {
            select: {
              guiasViajes: true,
              rutaPeajes: true,
              rutaRecargos: true,
            },
          },
        },
      });
    } catch (error) {
      this.manejarErrorPrisma(error, createRutaDto);
    }
  }

  // 2. Listar todas las rutas con filtros opcionales
  async findAll(options?: { idCliente?: string; activo?: boolean }) {
    const where: Prisma.RutaWhereInput = {};

    if (options?.idCliente) {
      where.idCliente = options.idCliente;
    }

    if (options?.activo !== undefined) {
      where.activo = options.activo;
    }

    return await this.prisma.ruta.findMany({
      where,
      orderBy: {
        nombreRuta: 'asc',
      },
      include: {
        cliente: {
          select: {
            idCliente: true,
            razonSocial: true,
            nombreComercial: true,
            rif: true,
          },
        },
        puntoOrigen: {
          select: {
            idPunto: true,
            codigoPuntoc: true,
            nombreSede: true,
            ciudad: true,
            estado: true,
            direccion: true,
          },
        },
        puntoDestino: {
          select: {
            idPunto: true,
            codigoPuntoc: true,
            nombreSede: true,
            ciudad: true,
            estado: true,
            direccion: true,
          },
        },
        _count: {
          select: {
            guiasViajes: true,
            rutaPeajes: true,
            rutaRecargos: true,
          },
        },
      },
    });
  }

  // 3. Listar rutas de un cliente específico
  async findByCliente(idCliente: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { idCliente },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${idCliente} no fue encontrado.`);
    }

    return await this.findAll({ idCliente });
  }

  // 4. Obtener detalle de una ruta por ID
  async findOne(id: string) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta: id },
      include: {
        cliente: true,
        puntoOrigen: true,
        puntoDestino: true,
        rutaPeajes: {
          orderBy: {
            orden: 'asc',
          },
        },
        rutaRecargos: true,
        _count: {
          select: {
            guiasViajes: true,
            rutaPeajes: true,
            rutaRecargos: true,
          },
        },
      },
    });

    if (!ruta) {
      throw new NotFoundException(`Ruta con ID ${id} no fue encontrada.`);
    }

    return ruta;
  }

  // 5. Actualizar una ruta existente
  async update(id: string, updateRutaDto: UpdateRutaDto) {
    const rutaExistente = await this.findOne(id);

    const targetClienteId = updateRutaDto.idCliente ?? rutaExistente.idCliente;

    const idPuntoOrigen =
      updateRutaDto.idPuntoOrigen !== undefined
        ? updateRutaDto.idPuntoOrigen && updateRutaDto.idPuntoOrigen.trim() !== ''
          ? updateRutaDto.idPuntoOrigen.trim()
          : null
        : rutaExistente.idPuntoOrigen;

    const idPuntoDestino =
      updateRutaDto.idPuntoDestino !== undefined
        ? updateRutaDto.idPuntoDestino && updateRutaDto.idPuntoDestino.trim() !== ''
          ? updateRutaDto.idPuntoDestino.trim()
          : null
        : rutaExistente.idPuntoDestino;

    await this.validarRelaciones(targetClienteId, idPuntoOrigen, idPuntoDestino);

    try {
      return await this.prisma.ruta.update({
        where: { idRuta: id },
        data: {
          ...(updateRutaDto.idCliente && { idCliente: updateRutaDto.idCliente }),
          ...(updateRutaDto.nombreRuta && { nombreRuta: updateRutaDto.nombreRuta.trim() }),
          ...(updateRutaDto.ciudadOrigen && { ciudadOrigen: updateRutaDto.ciudadOrigen.trim() }),
          ...(updateRutaDto.ciudadDestino && { ciudadDestino: updateRutaDto.ciudadDestino.trim() }),
          ...(updateRutaDto.idPuntoOrigen !== undefined && { idPuntoOrigen }),
          ...(updateRutaDto.idPuntoDestino !== undefined && { idPuntoDestino }),
          ...(updateRutaDto.distanciaKm !== undefined && { distanciaKm: updateRutaDto.distanciaKm }),
          ...(updateRutaDto.tiempoEstimadoHoras !== undefined && {
            tiempoEstimadoHoras: updateRutaDto.tiempoEstimadoHoras,
          }),
          ...(updateRutaDto.consumoEstimadoGasoil !== undefined && {
            consumoEstimadoGasoil: updateRutaDto.consumoEstimadoGasoil,
          }),
          ...(updateRutaDto.montoTarifa !== undefined && { montoTarifa: updateRutaDto.montoTarifa }),
          ...(updateRutaDto.tipoCobro !== undefined && { tipoCobro: updateRutaDto.tipoCobro }),
          ...(updateRutaDto.moneda !== undefined && { moneda: updateRutaDto.moneda.trim() }),
          ...(updateRutaDto.activo !== undefined && { activo: updateRutaDto.activo }),
        },
        include: {
          cliente: {
            select: {
              idCliente: true,
              razonSocial: true,
              nombreComercial: true,
              rif: true,
            },
          },
          puntoOrigen: {
            select: {
              idPunto: true,
              codigoPuntoc: true,
              nombreSede: true,
              ciudad: true,
              estado: true,
              direccion: true,
            },
          },
          puntoDestino: {
            select: {
              idPunto: true,
              codigoPuntoc: true,
              nombreSede: true,
              ciudad: true,
              estado: true,
              direccion: true,
            },
          },
          _count: {
            select: {
              guiasViajes: true,
              rutaPeajes: true,
              rutaRecargos: true,
            },
          },
        },
      });
    } catch (error) {
      this.manejarErrorPrisma(error, updateRutaDto);
    }
  }

  // 6. Cambiar estado activo / inactivo
  async toggleEstado(id: string) {
    const ruta = await this.findOne(id);

    return await this.prisma.ruta.update({
      where: { idRuta: id },
      data: {
        activo: !ruta.activo,
      },
    });
  }

  // 7. Eliminar una ruta
  async remove(id: string) {
    const ruta = await this.findOne(id);

    if (ruta._count?.guiasViajes > 0) {
      throw new BadRequestException(
        'No es posible eliminar la ruta debido a que tiene guías de viaje asociadas. Puede desactivarla para restringir su uso.',
      );
    }

    try {
      return await this.prisma.ruta.delete({
        where: { idRuta: id },
      });
    } catch (error) {
      this.manejarErrorPrisma(error);
    }
  }
}
