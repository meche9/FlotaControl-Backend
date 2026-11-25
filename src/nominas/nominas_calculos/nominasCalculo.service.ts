import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { Prisma, NominaCalculoEstado } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateNominaCalculoDto } from './dto/create-nomina-calculo.dto.js';
import { UpdateNominaCalculoDto } from './dto/update-nomina-calculo.dto.js';

@Injectable()
export class NominasCalculoService {
    constructor(private readonly prisma: PrismaService) { }

    private manejarErrorPrisma(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                throw new ConflictException(
                    'Ya existe un cálculo de nómina registrado para este conductor en el proceso seleccionado.',
                );
            }

            if (error.code === 'P2003') {
                const metaStr = JSON.stringify(error.meta ?? {});
                if (metaStr.includes('id_procesonomina') || metaStr.includes('proceso')) {
                    throw new BadRequestException(
                        'El proceso de nómina seleccionado (idProcesonomina) no es válido o no existe.',
                    );
                }
                if (metaStr.includes('id_conductor') || metaStr.includes('conductor')) {
                    throw new BadRequestException(
                        'El conductor seleccionado (idConductor) no es válido o no existe.',
                    );
                }
                throw new BadRequestException(
                    'Error de integridad referencial en el cálculo de nómina.',
                );
            }
        }
        throw error;
    }

    private async validarProcesoAbierto(idProcesonomina: string) {
        const proceso = await this.prisma.nominaProceso.findUnique({
            where: { idProcesonomina },
            include: { nomina: true },
        });

        if (!proceso) {
            throw new NotFoundException(
                `Proceso de nómina con ID ${idProcesonomina} no fue encontrado.`,
            );
        }

        if (proceso.fechaCierreP) {
            throw new BadRequestException(
                `El proceso de nómina '${proceso.codProcesonomina}' ya está cerrado.`,
            );
        }

        return proceso;
    }

    private async validarConductor(idConductor: string) {
        const conductor = await this.prisma.conductor.findUnique({
            where: { idConductor },
        });

        if (!conductor) {
            throw new NotFoundException(
                `Conductor con ID ${idConductor} no fue encontrado.`,
            );
        }

        return conductor;
    }

    // 1. Crear cálculo de nómina para un conductor en un proceso abierto
    async create(dto: CreateNominaCalculoDto) {
        await this.validarProcesoAbierto(dto.idProcesonomina);
        await this.validarConductor(dto.idConductor);

        const estado = dto.estado ?? NominaCalculoEstado.borrador;
        const fechaPago =
            estado === NominaCalculoEstado.pagado
                ? dto.fechaPago
                    ? new Date(dto.fechaPago)
                    : new Date()
                : null;

        try {
            return await this.prisma.nominaCalculo.create({
                data: {
                    idProcesonomina: dto.idProcesonomina,
                    idConductor: dto.idConductor,
                    salarioBase: dto.salarioBase ?? 0,
                    totalViajes: dto.totalViajes ?? 0,
                    totalFletes: dto.totalFletes ?? 0,
                    totalAsignaciones: dto.totalAsignaciones ?? 0,
                    totalDeducciones: dto.totalDeducciones ?? 0,
                    estado,
                    fechaPago,
                    observaciones: dto.observaciones ?? null,
                },
                include: {
                    proceso: {
                        select: {
                            idProcesonomina: true,
                            codProcesonomina: true,
                            fechaInicioP: true,
                            fechaFinP: true,
                            fechaCierreP: true,
                        },
                    },
                    conductor: {
                        select: {
                            idConductor: true,
                            cedulaIdentidad: true,
                            nombres: true,
                            apellidos: true,
                        },
                    },
                    detalles: true,
                },
            });
        } catch (error) {
            this.manejarErrorPrisma(error);
        }
    }

    // 2. Listar cálculos con filtros opcionales
    async findAll(options?: {
        idProcesonomina?: string;
        idConductor?: string;
        estado?: NominaCalculoEstado;
    }) {
        const where: Prisma.NominaCalculoWhereInput = {};

        if (options?.idProcesonomina) {
            where.idProcesonomina = options.idProcesonomina;
        }
        if (options?.idConductor) {
            where.idConductor = options.idConductor;
        }
        if (options?.estado) {
            where.estado = options.estado;
        }

        return await this.prisma.nominaCalculo.findMany({
            where,
            orderBy: {
                createAt: 'desc',
            },
            include: {
                proceso: {
                    select: {
                        idProcesonomina: true,
                        codProcesonomina: true,
                        fechaInicioP: true,
                        fechaFinP: true,
                        fechaCierreP: true,
                    },
                },
                conductor: {
                    select: {
                        idConductor: true,
                        cedulaIdentidad: true,
                        nombres: true,
                        apellidos: true,
                    },
                },
                _count: {
                    select: {
                        detalles: true,
                    },
                },
            },
        });
    }

    // 3. Obtener un cálculo por ID con su detalle
    async findOne(id: string) {
        const calculo = await this.prisma.nominaCalculo.findUnique({
            where: { idNominacalculo: id },
            include: {
                proceso: {
                    include: {
                        nomina: true,
                    },
                },
                conductor: true,
                detalles: {
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });

        if (!calculo) {
            throw new NotFoundException(
                `Cálculo de nómina con ID ${id} no fue encontrado.`,
            );
        }

        return calculo;
    }

    // 4. Actualizar montos, observaciones o estado de un cálculo
    async update(id: string, dto: UpdateNominaCalculoDto) {
        const existente = await this.findOne(id);

        if (
            existente.estado === NominaCalculoEstado.pagado &&
            dto.estado !== NominaCalculoEstado.pagado &&
            dto.estado !== undefined
        ) {
            throw new BadRequestException(
                'No se puede revertir el estado de un cálculo que ya fue pagado.',
            );
        }

        if (existente.proceso.fechaCierreP) {
            throw new BadRequestException(
                'No se puede modificar un cálculo perteneciente a un proceso ya cerrado.',
            );
        }

        const nuevoEstado = dto.estado ?? existente.estado;
        const nuevaFechaPago =
            nuevoEstado === NominaCalculoEstado.pagado
                ? dto.fechaPago !== undefined
                    ? dto.fechaPago
                        ? new Date(dto.fechaPago)
                        : new Date()
                    : existente.fechaPago ?? new Date()
                : null;

        try {
            return await this.prisma.nominaCalculo.update({
                where: { idNominacalculo: id },
                data: {
                    ...(dto.salarioBase !== undefined && { salarioBase: dto.salarioBase }),
                    ...(dto.totalViajes !== undefined && { totalViajes: dto.totalViajes }),
                    ...(dto.totalFletes !== undefined && { totalFletes: dto.totalFletes }),
                    ...(dto.totalAsignaciones !== undefined && {
                        totalAsignaciones: dto.totalAsignaciones,
                    }),
                    ...(dto.totalDeducciones !== undefined && {
                        totalDeducciones: dto.totalDeducciones,
                    }),
                    estado: nuevoEstado,
                    fechaPago: nuevaFechaPago,
                    ...(dto.observaciones !== undefined && {
                        observaciones: dto.observaciones,
                    }),
                },
                include: {
                    proceso: {
                        select: {
                            idProcesonomina: true,
                            codProcesonomina: true,
                            fechaInicioP: true,
                            fechaFinP: true,
                        },
                    },
                    conductor: {
                        select: {
                            idConductor: true,
                            cedulaIdentidad: true,
                            nombres: true,
                            apellidos: true,
                        },
                    },
                    detalles: true,
                },
            });
        } catch (error) {
            this.manejarErrorPrisma(error);
        }
    }

    // 5. Eliminar un cálculo en estado borrador
    async remove(id: string) {
        const existente = await this.findOne(id);

        if (existente.estado === NominaCalculoEstado.pagado) {
            throw new BadRequestException(
                'No es posible eliminar un cálculo de nómina ya pagado.',
            );
        }

        if (existente.proceso.fechaCierreP) {
            throw new BadRequestException(
                'No es posible eliminar un cálculo de un proceso cerrado.',
            );
        }

        return await this.prisma.nominaCalculo.delete({
            where: { idNominacalculo: id },
        });
    }
}