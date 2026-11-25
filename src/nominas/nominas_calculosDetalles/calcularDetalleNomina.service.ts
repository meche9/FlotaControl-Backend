import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import {
    Prisma,
    NominaCalculoEstado,
    NominaDeduccionTipoCalculo,
    GuiaOrdenEstado,
    GuiaRecargoEstado,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CalcularDetalleNominaDto } from './dto/calcular-detalle-nomina.dto.js';

@Injectable()
export class CalcularDetalleNominaService {
    constructor(private readonly prisma: PrismaService) { }

    private redondear(valor: number): number {
        return Number(valor.toFixed(2));
    }

    private toNumber(val: Prisma.Decimal | number | null | undefined): number {
        if (val === null || val === undefined) return 0;
        return typeof val === 'number' ? val : Number(val.toString());
    }

    private manejarErrorPrisma(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                throw new ConflictException(
                    'Conflicto de unicidad en el cálculo de nómina (proceso y conductor).',
                );
            }
            if (error.code === 'P2003') {
                throw new BadRequestException(
                    'Error de integridad referencial al guardar el cálculo o su detalle.',
                );
            }
        }
        throw error;
    }

    /**
     * Calcula y liquida viajes entregados + recargos + deducciones para un proceso abierto,
     * consolidando en `nominas_calculo` y registrando el desglose en `nominas_calculodetalle`.
     */
    async calcularDetalleNomina(dto: CalcularDetalleNominaDto) {
        const porcentajeViaje =
            dto.porcentajeViaje !== undefined ? Number(dto.porcentajeViaje) : 0.15;
        const descontarAnticipo = dto.descontarAnticipo ?? true;
        const descontarGasoil = dto.descontarGasoil ?? false;
        const marcarRecargosProcesados = dto.marcarRecargosProcesados ?? true;

        if (!dto.idProcesonomina || dto.idProcesonomina.trim() === '') {
            throw new BadRequestException('El campo idProcesonomina es obligatorio.');
        }

        if (porcentajeViaje < 0 || porcentajeViaje > 1) {
            throw new BadRequestException(
                'porcentajeViaje debe estar entre 0 y 1 (ejemplo: 0.15 para 15%).',
            );
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                // 1. Validar proceso de nómina y que su tipo de nómina esté activo
                const proceso = await tx.nominaProceso.findUnique({
                    where: { idProcesonomina: dto.idProcesonomina },
                    include: { nomina: true },
                });

                if (!proceso) {
                    throw new NotFoundException(
                        `Proceso de nómina con ID ${dto.idProcesonomina} no fue encontrado.`,
                    );
                }

                if (proceso.fechaCierreP) {
                    throw new BadRequestException(
                        `El proceso '${proceso.codProcesonomina}' ya está cerrado y no admite cálculos.`,
                    );
                }

                if (!proceso.nomina.activo) {
                    throw new BadRequestException(
                        `El tipo de nómina '${proceso.idCodnomina}' se encuentra inactivo.`,
                    );
                }

                // 2. Deducciones activas configuradas para este tipo de nómina
                const deduccionesReglas = await tx.nominaDeduccion.findMany({
                    where: {
                        idNomina: proceso.idCodnomina,
                        activo: true,
                    },
                    orderBy: { createdAt: 'asc' },
                });

                // 3. Buscar guías de viaje entregadas dentro del rango del proceso
                const fechaDesde = new Date(proceso.fechaInicioP);
                fechaDesde.setUTCHours(0, 0, 0, 0);

                const fechaHasta = new Date(proceso.fechaFinP);
                fechaHasta.setUTCHours(23, 59, 59, 999);

                const viajes = await tx.guiaViaje.findMany({
                    where: {
                        idConductor: dto.idConductor ? dto.idConductor : { not: null },
                        estadoOrden: GuiaOrdenEstado.Entregado,
                        AND: [
                            {
                                OR: [
                                    {
                                        fechaEntregaReal: {
                                            gte: fechaDesde,
                                            lte: fechaHasta,
                                        },
                                    },
                                    {
                                        AND: [
                                            { fechaEntregaReal: null },
                                            {
                                                fechaProgramadaCarga: {
                                                    gte: fechaDesde,
                                                    lte: fechaHasta,
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    include: {
                        conductor: {
                            select: {
                                idConductor: true,
                                cedulaIdentidad: true,
                                nombres: true,
                                apellidos: true,
                            },
                        },
                        guiasViajesRecargos: {
                            where: {
                                estado: {
                                    in: [GuiaRecargoEstado.Pendiente, GuiaRecargoEstado.Procesado],
                                },
                            },
                            include: {
                                recargo: {
                                    select: {
                                        idRecargo: true,
                                        concepto: true,
                                        moneda: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: [{ idConductor: 'asc' }, { fechaCreacion: 'asc' }],
                });

                if (viajes.length === 0) {
                    return {
                        idProcesonomina: proceso.idProcesonomina,
                        codProcesonomina: proceso.codProcesonomina,
                        conductoresProcesados: 0,
                        calculos: [],
                    };
                }

                // 4. Agrupar viajes por conductor
                const viajesPorConductor = new Map<string, typeof viajes>();
                for (const viaje of viajes) {
                    if (!viaje.idConductor) continue;
                    const lista = viajesPorConductor.get(viaje.idConductor) ?? [];
                    lista.push(viaje);
                    viajesPorConductor.set(viaje.idConductor, lista);
                }

                const resultados: Array<Record<string, unknown>> = [];

                // 5. Calcular y persistir cabecera + detalle por conductor
                for (const [idConductor, viajesConductor] of viajesPorConductor.entries()) {
                    const existente = await tx.nominaCalculo.findUnique({
                        where: {
                            idProcesonomina_idConductor: {
                                idProcesonomina: proceso.idProcesonomina,
                                idConductor,
                            },
                        },
                    });

                    if (existente && existente.estado === NominaCalculoEstado.pagado) {
                        resultados.push({
                            idNominacalculo: existente.idNominacalculo,
                            idConductor,
                            estado: existente.estado,
                            omitido: true,
                            motivo: 'El cálculo ya se encuentra pagado.',
                        });
                        continue;
                    }

                    const salarioBase = this.redondear(
                        dto.salarioBase !== undefined
                            ? Number(dto.salarioBase)
                            : this.toNumber(existente?.salarioBase),
                    );
                    const estadoActual = existente?.estado ?? NominaCalculoEstado.borrador;
                    const monedaBase = viajesConductor[0]?.moneda || 'USD';

                    let totalFletes = 0;
                    let totalViajes = 0;
                    let totalAsignaciones = 0;
                    let totalDescuentosOperativos = 0;

                    const detallesData: Prisma.NominaCalculoDetalleCreateManyInput[] = [];
                    const idsRecargosPendientes: string[] = [];

                    for (const viaje of viajesConductor) {
                        const flete = this.toNumber(viaje.montoFleteCliente);
                        const comisionViaje = this.redondear(flete * porcentajeViaje);
                        const anticipo = this.toNumber(viaje.montoAnticipoConductor);
                        const gasoil = this.toNumber(viaje.montoGasoil);
                        const monedaViaje = viaje.moneda || monedaBase;

                        totalFletes = this.redondear(totalFletes + flete);
                        totalViajes = this.redondear(totalViajes + comisionViaje);

                        // Asignación (true = 1): comisión/pago por guía de viaje
                        detallesData.push({
                            idProcesonomina: proceso.idProcesonomina,
                            idConductor,
                            tipoConcepto: true,
                            codigoConcepto: viaje.idOrden,
                            monto: comisionViaje,
                            moneda: monedaViaje,
                        });

                        // Deducción (false = 0): anticipo del conductor
                        if (descontarAnticipo && anticipo > 0) {
                            const montoAnticipo = this.redondear(anticipo);
                            totalDescuentosOperativos = this.redondear(
                                totalDescuentosOperativos + montoAnticipo,
                            );
                            detallesData.push({
                                idProcesonomina: proceso.idProcesonomina,
                                idConductor,
                                tipoConcepto: false,
                                codigoConcepto: viaje.idOrden,
                                monto: montoAnticipo,
                                moneda: monedaViaje,
                            });
                        }

                        // Deducción opcional (false = 0): gasoil
                        if (descontarGasoil && gasoil > 0) {
                            const montoGasoil = this.redondear(gasoil);
                            totalDescuentosOperativos = this.redondear(
                                totalDescuentosOperativos + montoGasoil,
                            );
                            detallesData.push({
                                idProcesonomina: proceso.idProcesonomina,
                                idConductor,
                                tipoConcepto: false,
                                codigoConcepto: viaje.idOrden,
                                monto: montoGasoil,
                                moneda: monedaViaje,
                            });
                        }

                        // Asignaciones (true = 1): recargos del viaje
                        for (const rec of viaje.guiasViajesRecargos) {
                            const montoRec = this.redondear(this.toNumber(rec.monto));
                            totalAsignaciones = this.redondear(totalAsignaciones + montoRec);

                            if (rec.estado === GuiaRecargoEstado.Pendiente) {
                                idsRecargosPendientes.push(rec.idViajeRecargo);
                            }

                            detallesData.push({
                                idProcesonomina: proceso.idProcesonomina,
                                idConductor,
                                tipoConcepto: true,
                                codigoConcepto: rec.idRecargo || rec.idViajeRecargo,
                                monto: montoRec,
                                moneda: rec.recargo?.moneda || monedaViaje,
                            });
                        }
                    }

                    // Deducciones configuradas en `nominas_deducciones`
                    const baseDevengada = this.redondear(
                        salarioBase + totalViajes + totalAsignaciones,
                    );
                    let totalDeduccionesReglas = 0;

                    for (const regla of deduccionesReglas) {
                        const valorRegla = this.toNumber(regla.valor);
                        const montoDed =
                            regla.tipocalculo === NominaDeduccionTipoCalculo.porcentaje
                                ? this.redondear((baseDevengada * valorRegla) / 100)
                                : this.redondear(valorRegla);

                        totalDeduccionesReglas = this.redondear(
                            totalDeduccionesReglas + montoDed,
                        );

                        detallesData.push({
                            idProcesonomina: proceso.idProcesonomina,
                            idConductor,
                            tipoConcepto: false,
                            codigoConcepto: regla.idDeducciones,
                            monto: montoDed,
                            moneda: regla.moneda || monedaBase,
                        });
                    }

                    const totalDeducciones = this.redondear(
                        totalDeduccionesReglas + totalDescuentosOperativos,
                    );
                    const netoAPagar = this.redondear(baseDevengada - totalDeducciones);
                    const observaciones = `Guías: ${viajesConductor.length} | Neto: ${netoAPagar.toFixed(2)} ${monedaBase}`;

                    const calculoGuardado = await tx.nominaCalculo.upsert({
                        where: {
                            idProcesonomina_idConductor: {
                                idProcesonomina: proceso.idProcesonomina,
                                idConductor,
                            },
                        },
                        create: {
                            idProcesonomina: proceso.idProcesonomina,
                            idConductor,
                            salarioBase,
                            totalViajes,
                            totalFletes,
                            totalAsignaciones,
                            totalDeducciones,
                            estado: estadoActual,
                            fechaPago: null,
                            observaciones,
                        },
                        update: {
                            salarioBase,
                            totalViajes,
                            totalFletes,
                            totalAsignaciones,
                            totalDeducciones,
                            observaciones,
                        },
                    });

                    // Reemplazar detalles del conductor en este proceso
                    await tx.nominaCalculoDetalle.deleteMany({
                        where: {
                            idProcesonomina: proceso.idProcesonomina,
                            idConductor,
                        },
                    });

                    if (detallesData.length > 0) {
                        await tx.nominaCalculoDetalle.createMany({
                            data: detallesData,
                        });
                    }

                    // Marcar recargos pendientes incluidos como Procesado
                    if (marcarRecargosProcesados && idsRecargosPendientes.length > 0) {
                        await tx.guiaViajeRecargo.updateMany({
                            where: {
                                idViajeRecargo: { in: idsRecargosPendientes },
                                estado: GuiaRecargoEstado.Pendiente,
                            },
                            data: {
                                estado: GuiaRecargoEstado.Procesado,
                                fechaActualizacion: new Date(),
                            },
                        });
                    }

                    const detallesPersistidos = await tx.nominaCalculoDetalle.findMany({
                        where: {
                            idProcesonomina: proceso.idProcesonomina,
                            idConductor,
                        },
                        orderBy: { createdAt: 'asc' },
                    });

                    resultados.push({
                        idNominacalculo: calculoGuardado.idNominacalculo,
                        idConductor,
                        conductor: viajesConductor[0]?.conductor ?? null,
                        cantidadViajes: viajesConductor.length,
                        salarioBase,
                        totalViajes,
                        totalFletes,
                        totalAsignaciones,
                        totalDeducciones,
                        netoAPagar,
                        moneda: monedaBase,
                        estado: calculoGuardado.estado,
                        detalles: detallesPersistidos,
                    });
                }

                return {
                    idProcesonomina: proceso.idProcesonomina,
                    codProcesonomina: proceso.codProcesonomina,
                    conductoresProcesados: resultados.length,
                    calculos: resultados,
                };
            });
        } catch (error) {
            this.manejarErrorPrisma(error);
        }
    }

    /**
     * Consulta el desglose de asignaciones y deducciones de un proceso (opcionalmente por conductor).
     */
    async obtenerDetalles(idProcesonomina: string, idConductor?: string) {
        const proceso = await this.prisma.nominaProceso.findUnique({
            where: { idProcesonomina },
        });

        if (!proceso) {
            throw new NotFoundException(
                `Proceso de nómina con ID ${idProcesonomina} no fue encontrado.`,
            );
        }

        const where: Prisma.NominaCalculoDetalleWhereInput = {
            idProcesonomina,
            ...(idConductor ? { idConductor } : {}),
        };

        const detalles = await this.prisma.nominaCalculoDetalle.findMany({
            where,
            include: {
                conductor: {
                    select: {
                        idConductor: true,
                        cedulaIdentidad: true,
                        nombres: true,
                        apellidos: true,
                    },
                },
            },
            orderBy: [{ idConductor: 'asc' }, { createdAt: 'asc' }],
        });

        return {
            proceso,
            totalRegistros: detalles.length,
            asignaciones: detalles.filter((d) => d.tipoConcepto === true),
            deducciones: detalles.filter((d) => d.tipoConcepto === false),
            detalles,
        };
    }
}