import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateProcesoNominaDto } from './dto/create-proceso-nomina.dto.js';
import { UpdateProcesoNominaDto } from './dto/update-proceso-nomina.dto.js';

@Injectable()
export class NominasProcesosService {
    constructor(private readonly prisma: PrismaService) { }

    private manejarErrorPrisma(
        error: unknown,
        dto?: Partial<CreateProcesoNominaDto>,
    ): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                const codMsg = dto?.codProcesonomina ? ` '${dto.codProcesonomina}'` : '';
                throw new ConflictException(
                    `Ya existe un proceso de nómina registrado con el código${codMsg}.`,
                );
            }

            if (error.code === 'P2003') {
                throw new BadRequestException(
                    'El tipo de nómina seleccionado (idCodnomina) no es válido o no existe.',
                );
            }
        }
        throw error;
    }

    private validarFechas(
        fechaInicioStr: string,
        fechaFinStr: string,
    ): { fechaInicio: Date; fechaFin: Date } {
        const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
        if (!regexFecha.test(fechaInicioStr) || !regexFecha.test(fechaFinStr)) {
            throw new BadRequestException(
                'Las fechas fechaInicioP y fechaFinP deben tener el formato YYYY-MM-DD.',
            );
        }

        const fechaInicio = new Date(`${fechaInicioStr}T00:00:00.000Z`);
        const fechaFin = new Date(`${fechaFinStr}T23:59:59.999Z`);

        if (fechaInicio > fechaFin) {
            throw new BadRequestException(
                'La fecha de inicio (fechaInicioP) no puede ser mayor que la fecha de fin (fechaFinP).',
            );
        }

        return { fechaInicio, fechaFin };
    }

    private async validarNominaActiva(idCodnomina: string) {
        const nomina = await this.prisma.nomina.findUnique({
            where: { idCodnomina },
        });

        if (!nomina) {
            throw new NotFoundException(
                `Tipo de nómina con código '${idCodnomina}' no fue encontrado.`,
            );
        }

        if (!nomina.activo) {
            throw new BadRequestException(
                `El tipo de nómina '${idCodnomina}' (${nomina.modalidad}) se encuentra inactivo.`,
            );
        }

        return nomina;
    }

    // 1. Abrir un nuevo proceso de nómina (fechaCierreP = null)
    async abrirProceso(dto: CreateProcesoNominaDto) {
        const idCodnomina = dto.idCodnomina?.trim().toUpperCase();
        const codProcesonomina = dto.codProcesonomina?.trim().toUpperCase();

        if (!idCodnomina || idCodnomina.length !== 2) {
            throw new BadRequestException(
                'El código de nómina (idCodnomina) debe tener exactamente 2 caracteres.',
            );
        }

        if (!codProcesonomina || codProcesonomina.length > 9) {
            throw new BadRequestException(
                'El código del proceso (codProcesonomina) es obligatorio y máximo de 9 caracteres.',
            );
        }

        const { fechaInicio, fechaFin } = this.validarFechas(
            dto.fechaInicioP?.trim(),
            dto.fechaFinP?.trim(),
        );

        await this.validarNominaActiva(idCodnomina);

        // Evitar solapamiento con otro proceso abierto del mismo tipo de nómina
        const procesoSolapado = await this.prisma.nominaProceso.findFirst({
            where: {
                idCodnomina,
                fechaCierreP: null,
                AND: [
                    { fechaInicioP: { lte: fechaFin } },
                    { fechaFinP: { gte: fechaInicio } },
                ],
            },
        });

        if (procesoSolapado) {
            throw new ConflictException(
                `Ya existe un proceso abierto (${procesoSolapado.codProcesonomina}) que se solapa con el rango solicitado.`,
            );
        }

        try {
            return await this.prisma.nominaProceso.create({
                data: {
                    idCodnomina,
                    codProcesonomina,
                    fechaInicioP: fechaInicio,
                    fechaFinP: fechaFin,
                    fechaCierreP: null,
                },
                include: {
                    nomina: {
                        select: {
                            idCodnomina: true,
                            modalidad: true,
                            descripcion: true,
                            activo: true,
                        },
                    },
                    _count: {
                        select: {
                            calculos: true,
                        },
                    },
                },
            });
        } catch (error) {
            this.manejarErrorPrisma(error, dto);
        }
    }

    // 2. Listar tipos de nómina (tabla nominas)
    async listarTiposNomina() {
        return await this.prisma.nomina.findMany({
            orderBy: { idCodnomina: 'asc' },
            select: {
                idCodnomina: true,
                modalidad: true,
                descripcion: true,
                activo: true,
            },
        });
    }

    // 3. Listar procesos con filtros opcionales
    async findAll(options?: { idCodnomina?: string; soloAbiertos?: boolean }) {
        const where: Prisma.NominaProcesoWhereInput = {};

        if (options?.idCodnomina) {
            where.idCodnomina = options.idCodnomina.trim().toUpperCase();
        }

        if (options?.soloAbiertos) {
            where.fechaCierreP = null;
        }

        return await this.prisma.nominaProceso.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                nomina: {
                    select: {
                        idCodnomina: true,
                        modalidad: true,
                        descripcion: true,
                        activo: true,
                    },
                },
                _count: {
                    select: {
                        calculos: true,
                    },
                },
            },
        });
    }

    // 3. Obtener un proceso por ID
    async findOne(id: string) {
        const proceso = await this.prisma.nominaProceso.findUnique({
            where: { idProcesonomina: id },
            include: {
                nomina: true,
                _count: {
                    select: {
                        calculos: true,
                    },
                },
            },
        });

        if (!proceso) {
            throw new NotFoundException(
                `Proceso de nómina con ID ${id} no fue encontrado.`,
            );
        }

        return proceso;
    }

    // 4. Actualizar proceso mientras esté abierto
    async update(id: string, dto: UpdateProcesoNominaDto) {
        const procesoExistente = await this.findOne(id);

        if (procesoExistente.fechaCierreP) {
            throw new BadRequestException(
                'No es posible modificar un proceso de nómina que ya fue cerrado.',
            );
        }

        const inicioStr =
            dto.fechaInicioP ??
            procesoExistente.fechaInicioP.toISOString().slice(0, 10);
        const finStr =
            dto.fechaFinP ?? procesoExistente.fechaFinP.toISOString().slice(0, 10);

        const { fechaInicio, fechaFin } = this.validarFechas(inicioStr, finStr);

        try {
            return await this.prisma.nominaProceso.update({
                where: { idProcesonomina: id },
                data: {
                    ...(dto.codProcesonomina !== undefined && {
                        codProcesonomina: dto.codProcesonomina.trim().toUpperCase(),
                    }),
                    ...(dto.fechaInicioP !== undefined && { fechaInicioP: fechaInicio }),
                    ...(dto.fechaFinP !== undefined && { fechaFinP: fechaFin }),
                    ...(dto.fechaCierreP !== undefined && {
                        fechaCierreP: dto.fechaCierreP ? new Date(dto.fechaCierreP) : null,
                    }),
                },
                include: {
                    nomina: {
                        select: {
                            idCodnomina: true,
                            modalidad: true,
                            descripcion: true,
                            activo: true,
                        },
                    },
                },
            });
        } catch (error) {
            this.manejarErrorPrisma(error, dto);
        }
    }
}