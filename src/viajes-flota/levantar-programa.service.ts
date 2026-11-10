import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import FormData from 'form-data';
import axios from 'axios';

@Injectable()
export class LevantarProgramaService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

    /**
     * Procesa el PDF mediante el microservicio extractor en Python
     * y valida cada viaje contra la tabla guias_viajes para detectar colisiones/duplicados.
     */
    async getSchedulePreview(file: any) {
        if (!file) {
            throw new HttpException('No se ha adjuntado ningún archivo PDF.', HttpStatus.BAD_REQUEST);
        }

        const formData = new FormData();
        formData.append('file', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype || 'application/pdf',
        });

        let rawTrips: any[] = [];

        const extractorUrl = this.config.get<string>('EXTRACTOR_URL') ?? 'http://127.0.0.1:8000';

        try {
            const pythonResponse = await axios.post(`${extractorUrl}/extract-schedule`, formData, {
                headers: { ...formData.getHeaders() },
                timeout: 30000,
            });

            rawTrips = pythonResponse.data.trips || [];
        } catch (error: unknown) {
            const err = error as any;
            const errorMsg = err.response?.data?.detail || err.message;
            throw new HttpException(
                `Error al procesar el PDF en el extractor: ${errorMsg}. Verifique que el servicio extractor esté en ejecución en el puerto 8000.`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        if (rawTrips.length === 0) {
            return {
                nombreArchivo: file.originalname,
                totalViajes: 0,
                colisiones: 0,
                nuevos: 0,
                trips: [],
                todosExisten: false,
                conductoresDisponibles: [],
                puntosDisponibles: [],
            };
        }

        // 1. Extraer los números de guía para validar contra la tabla guias_viajes
        const numerosGuia = rawTrips
            .map((t: any) => (t.guia_viaje || '').trim())
            .filter((n: string) => Boolean(n) && n !== 'S/N');

        // 2. Consultar guias_viajes existentes en la base de datos
        const guiasExistentes = await this.prisma.guiaViaje.findMany({
            where: {
                nroTransporte: {
                    in: numerosGuia,
                },
            },
            select: {
                idOrden: true,
                nroTransporte: true,
                estadoOrden: true,
                fisico: true,
                fechaProgramadaCarga: true,
                conductor: {
                    select: {
                        nombres: true,
                        apellidos: true,
                    },
                },
            },
        });

        const guiasMap = new Map<string, (typeof guiasExistentes)[0]>();
        for (const g of guiasExistentes) {
            if (g.nroTransporte) {
                guiasMap.set(g.nroTransporte.trim().toUpperCase(), g);
            }
        }

        // 3. Obtener puntos de carga/descarga y conductores registrados en el sistema
        const [puntosBd, conductoresBd] = await Promise.all([
            this.prisma.puntoCargaDescarga.findMany({
                where: { activo: true },
                select: {
                    idPunto: true,
                    codigoPuntoc: true,
                    nombreSede: true,
                    ciudad: true,
                    estado: true,
                    idCliente: true,
                    cliente: {
                        select: {
                            idCliente: true,
                            razonSocial: true,
                            nombreComercial: true,
                            rif: true,
                        },
                    },
                },
            }),
            this.prisma.conductor.findMany({
                where: { estado: 'Activo' },
                select: {
                    idConductor: true,
                    nombres: true,
                    apellidos: true,
                    telefono: true,
                    estado: true,
                    vehiculoHabitual: {
                        select: {
                            idVehiculo: true,
                            placa: true,
                            marca: true,
                            modelo: true,
                        },
                    },
                },
            }),
        ]);

        const puntosPorCodigo = new Map<string, (typeof puntosBd)[0]>();
        const puntosPorNombre = new Map<string, (typeof puntosBd)[0]>();
        for (const p of puntosBd) {
            if (p.codigoPuntoc) {
                puntosPorCodigo.set(p.codigoPuntoc.trim().toUpperCase(), p);
            }
            if (p.nombreSede) {
                puntosPorNombre.set(p.nombreSede.trim().toUpperCase(), p);
            }
        }

        // 4. Mapear y formatear cada viaje con verificación de colisión
        const formattedTrips = rawTrips.map((trip: any, index: number) => {
            const nroGuia = (trip.guia_viaje || `TR-AUTO-${Date.now().toString().slice(-4)}-${index + 1}`).trim();
            const nroKey = nroGuia.toUpperCase();
            const colisionEncontrada = guiasMap.get(nroKey);
            const yaExiste = Boolean(colisionEncontrada);

            const codOrigen = (trip.cod_origen || '').trim().toUpperCase();
            const nomOrigen = (trip.punto_origen || '').trim().toUpperCase();

            let puntoOrigenBd = codOrigen ? puntosPorCodigo.get(codOrigen) : null;
            if (!puntoOrigenBd && codOrigen) {
                puntoOrigenBd = puntosBd.find(
                    (p) => p.codigoPuntoc && (p.codigoPuntoc.toUpperCase() === codOrigen || codOrigen.includes(p.codigoPuntoc.toUpperCase()))
                );
            }
            if (!puntoOrigenBd && nomOrigen) {
                puntoOrigenBd =
                    puntosPorNombre.get(nomOrigen) ||
                    puntosBd.find(
                        (p) =>
                            nomOrigen.includes(p.nombreSede.toUpperCase()) ||
                            p.nombreSede.toUpperCase().includes(nomOrigen)
                    );
            }

            const codDestino = (trip.cod_destino || '').trim().toUpperCase();
            const nomDestino = (trip.punto_destino || '').trim().toUpperCase();

            let puntoDestinoBd = codDestino ? puntosPorCodigo.get(codDestino) : null;
            if (!puntoDestinoBd && codDestino) {
                puntoDestinoBd = puntosBd.find(
                    (p) => p.codigoPuntoc && (p.codigoPuntoc.toUpperCase() === codDestino || codDestino.includes(p.codigoPuntoc.toUpperCase()))
                );
            }
            if (!puntoDestinoBd && nomDestino) {
                puntoDestinoBd =
                    puntosPorNombre.get(nomDestino) ||
                    puntosBd.find(
                        (p) =>
                            nomDestino.includes(p.nombreSede.toUpperCase()) ||
                            p.nombreSede.toUpperCase().includes(nomDestino)
                    );
            }

            // Código de retorno sugerido
            const nroDigitos = nroGuia.replace(/[^0-9]/g, '').slice(-4) || String(9000 + index);
            const nroRetornoSugerido = `RET-${nroDigitos}-A`;

            return {
                id: `trip-${randomUUID()}`,
                nroTransporte: nroGuia,
                origenSalida: {
                    codigo: (trip.cod_origen || '').trim() || (puntoOrigenBd ? puntoOrigenBd.codigoPuntoc : 'S/C'),
                    nombre: trip.punto_origen || (puntoOrigenBd ? puntoOrigenBd.nombreSede : 'Origen'),
                    idPunto: puntoOrigenBd ? puntoOrigenBd.idPunto : null,
                    idCliente: puntoOrigenBd ? puntoOrigenBd.idCliente : null,
                    clienteNombre: puntoOrigenBd?.cliente?.razonSocial || puntoOrigenBd?.cliente?.nombreComercial || null,
                    clienteRif: puntoOrigenBd?.cliente?.rif || null,
                },
                destinoLlegada: {
                    codigo: (trip.cod_destino || '').trim() || (puntoDestinoBd ? puntoDestinoBd.codigoPuntoc : 'S/C'),
                    nombre: trip.punto_destino || (puntoDestinoBd ? puntoDestinoBd.nombreSede : 'Destino'),
                    idPunto: puntoDestinoBd ? puntoDestinoBd.idPunto : null,
                },
                fechaProgramadaCarga: (trip.fecha_i || '').replace(/\./g, '/').trim(),
                horaProgramadaCarga: trip.hora_i || '',
                fechaEntregaEstimada: (trip.fecha_f || trip.fecha_i || '').replace(/\./g, '/').trim(),
                horaEntregaEstimada: trip.hora_f || trip.hora_i || '',
                conductorAsignado: null as any,
                idConductor: null as string | null,
                nroRetorno: nroRetornoSugerido,
                puntoRegreso: codOrigen ? `[${codOrigen}] ${trip.punto_origen || 'Planta Origen'}` : 'Planta Origen',
                estadoPendienteChofer: true,
                observacion: trip.observacion || '',
                fisico: Boolean(trip.fisico ?? false),
                // Bandera de verificación de existencia en guias_viajes
                yaExiste,
                colision: yaExiste,
                colisionDetalle: colisionEncontrada
                    ? {
                        idOrden: colisionEncontrada.idOrden,
                        estadoOrden: colisionEncontrada.estadoOrden,
                        fisico: colisionEncontrada.fisico,
                        fechaProgramadaCarga: colisionEncontrada.fechaProgramadaCarga,
                        conductorAsignado: colisionEncontrada.conductor
                            ? `${colisionEncontrada.conductor.nombres} ${colisionEncontrada.conductor.apellidos}`
                            : null,
                    }
                    : null,
            };
        });

        // 5. Determinar el cliente a partir del código o unidad de origen detectado
        let clienteDetectado: {
            idCliente: string;
            razonSocial: string;
            nombreComercial: string;
            rif: string;
        } | null = null;

        for (const t of formattedTrips) {
            if (t.origenSalida.idPunto) {
                const p = puntosBd.find((pt) => pt.idPunto === t.origenSalida.idPunto);
                if (p?.cliente) {
                    clienteDetectado = {
                        idCliente: p.cliente.idCliente,
                        razonSocial: p.cliente.razonSocial,
                        nombreComercial: p.cliente.nombreComercial || p.cliente.razonSocial,
                        rif: p.cliente.rif,
                    };
                    break;
                }
            }
        }

        // 6. Ordenar cronológicamente por fechaProgramadaCarga y horaProgramadaCarga
        const parseSortTimestamp = (dStr: string, tStr: string): number => {
            if (!dStr) return 9999999999999;
            const matchDMY = dStr.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
            let y = 0, m = 0, d = 0;
            if (matchDMY) {
                d = parseInt(matchDMY[1], 10);
                m = parseInt(matchDMY[2], 10) - 1;
                y = parseInt(matchDMY[3], 10);
                if (y < 100) y += 2000;
            } else {
                const matchYMD = dStr.trim().match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
                if (matchYMD) {
                    y = parseInt(matchYMD[1], 10);
                    m = parseInt(matchYMD[2], 10) - 1;
                    d = parseInt(matchYMD[3], 10);
                }
            }
            let timeMins = 0;
            if (tStr) {
                const tMatch = tStr.trim().toUpperCase().match(/(\d{1,2}):(\d{2})/);
                if (tMatch) {
                    let h = parseInt(tMatch[1], 10);
                    const min = parseInt(tMatch[2], 10);
                    if (tStr.toUpperCase().includes('PM') && h < 12) h += 12;
                    if (tStr.toUpperCase().includes('AM') && h === 12) h = 0;
                    timeMins = h * 60 + min;
                }
            }
            if (y > 0) {
                return new Date(y, m, d).getTime() + timeMins * 60000;
            }
            return 9999999999999;
        };

        formattedTrips.sort((a, b) => {
            return parseSortTimestamp(a.fechaProgramadaCarga, a.horaProgramadaCarga) -
                parseSortTimestamp(b.fechaProgramadaCarga, b.horaProgramadaCarga);
        });

        const colisionesCount = formattedTrips.filter((t: any) => t.yaExiste).length;
        const nuevosCount = formattedTrips.length - colisionesCount;

        return {
            nombreArchivo: file.originalname,
            totalViajes: formattedTrips.length,
            colisiones: colisionesCount,
            nuevos: nuevosCount,
            todosExisten: formattedTrips.length > 0 && colisionesCount === formattedTrips.length,
            clienteDetectado,
            trips: formattedTrips,
            conductoresDisponibles: conductoresBd.map((c: any) => ({
                idConductor: c.idConductor,
                nombreCompleto: `${c.nombres} ${c.apellidos}`,
                telefono: c.telefono,
                estado: c.estado,
                placaVehiculoHabitual: c.vehiculoHabitual?.placa || null,
                vehiculoHabitual: c.vehiculoHabitual
                    ? `${c.vehiculoHabitual.marca} ${c.vehiculoHabitual.modelo || ''} (${c.vehiculoHabitual.placa})`
                    : null,
            })),
            puntosDisponibles: puntosBd.map((p: any) => ({
                idPunto: p.idPunto,
                codigoPuntoc: p.codigoPuntoc,
                nombreSede: p.nombreSede,
                ciudad: p.ciudad,
                estado: p.estado,
                idCliente: p.idCliente,
                cliente: p.cliente
                    ? {
                        idCliente: p.cliente.idCliente,
                        razonSocial: p.cliente.razonSocial,
                        nombreComercial: p.cliente.nombreComercial || p.cliente.razonSocial,
                        rif: p.cliente.rif,
                    }
                    : null,
            })),
        };
    }

    /**
     * Guarda en la tabla guias_viajes únicamente los viajes confirmados que NO existan previamente.
     */
    async saveConfirmedSchedule(payload: any) {
        const rawTrips = Array.isArray(payload) ? payload : payload?.trips;

        if (!Array.isArray(rawTrips) || rawTrips.length === 0) {
            throw new HttpException('No se enviaron viajes para confirmar y guardar.', HttpStatus.BAD_REQUEST);
        }

        // 1. Extraer identificadores y verificar nuevamente colisiones directas en BD
        const numerosGuia = rawTrips
            .map((t: any) => (t.nroTransporte || '').trim())
            .filter((n: string) => Boolean(n) && n !== 'S/N');

        const guiasExistentes = await this.prisma.guiaViaje.findMany({
            where: {
                nroTransporte: {
                    in: numerosGuia,
                },
            },
            select: { nroTransporte: true },
        });

        const existingSet = new Set(guiasExistentes.map((g) => (g.nroTransporte || '').trim().toUpperCase()));

        // Filtrar solo los viajes que NO existen en guias_viajes
        const tripsToInsert = rawTrips.filter((t: any) => {
            const key = (t.nroTransporte || '').trim().toUpperCase();
            return !existingSet.has(key);
        });

        if (tripsToInsert.length === 0) {
            return {
                success: false,
                message: 'Todos los viajes seleccionados ya existen en la base de datos (guias_viajes). No se insertaron duplicados.',
                guardados: 0,
                omitidosPorColision: rawTrips.length,
            };
        }

        // 2. Obtener cliente y puntos por defecto si no están asignados
        const payloadIdCliente = payload?.idCliente || payload?.clienteDetectado?.idCliente;

        const [primerCliente, primerPunto, primerRuta] = await Promise.all([
            this.prisma.cliente.findFirst({
                orderBy: { fechaCreacion: 'asc' },
                select: { idCliente: true, razonSocial: true },
            }),
            this.prisma.puntoCargaDescarga.findFirst({ select: { idPunto: true, idCliente: true } }),
            this.prisma.ruta.findFirst({ select: { idRuta: true, montoTarifa: true } }),
        ]);

        const idClienteFallback = payloadIdCliente || primerPunto?.idCliente || primerCliente?.idCliente;
        if (!idClienteFallback) {
            throw new HttpException(
                'No se puede registrar viajes en guias_viajes sin al menos un Cliente registrado en el sistema.',
                HttpStatus.PRECONDITION_FAILED,
            );
        }

        // Cache local para puntos y rutas durante este lote de inserción
        const puntosMap = new Map<string, string>();
        const rutasMap = new Map<string, { idRuta: string; tarifa: number }>();

        // 3. Insertar viajes válidos
        const creados: any[] = [];

        for (const trip of tripsToInsert) {
            // Resolver fechas de forma segura
            const parseDate = (dStr: string, tStr: string): Date => {
                if (!dStr || !dStr.trim()) return new Date();
                try {
                    const cleanDate = dStr.trim().replace(/\./g, '/').replace(/-/g, '/');
                    const parts = cleanDate.split('/');
                    if (parts.length === 3) {
                        let year = parseInt(parts[2], 10);
                        let month = parseInt(parts[1], 10) - 1;
                        let day = parseInt(parts[0], 10);
                        if (parts[0].length === 4) {
                            year = parseInt(parts[0], 10);
                            month = parseInt(parts[1], 10) - 1;
                            day = parseInt(parts[2], 10);
                        }
                        if (year < 100) year += 2000;
                        const timeParts = (tStr || '06:00').split(':');
                        let hours = parseInt(timeParts[0], 10) || 6;
                        const minutes = parseInt(timeParts[1], 10) || 0;
                        if (tStr && tStr.toUpperCase().includes('PM') && hours < 12) hours += 12;
                        if (tStr && tStr.toUpperCase().includes('AM') && hours === 12) hours = 0;
                        const d = new Date(Date.UTC(year, month, day, hours, minutes));
                        if (!isNaN(d.getTime())) return d;
                    }
                    const d = new Date(dStr);
                    if (!isNaN(d.getTime())) return d;
                    return new Date();
                } catch {
                    return new Date();
                }
            };

            const fechaCarga = parseDate(trip.fechaProgramadaCarga, trip.horaProgramadaCarga);
            const fechaEntrega = parseDate(
                trip.fechaEntregaEstimada || trip.fechaProgramadaCarga,
                trip.horaEntregaEstimada || trip.horaProgramadaCarga || '18:00'
            );

            const idCliente = trip.origenSalida?.idCliente || idClienteFallback;

            // Resolver o crear punto de origen
            let idPuntoOrigen = trip.origenSalida?.idPunto;
            const codOrigen = (trip.origenSalida?.codigo || '').trim();
            const nomOrigen = (trip.origenSalida?.nombre || '').trim();

            if (!idPuntoOrigen && (codOrigen || nomOrigen)) {
                const cacheKey = `O_${codOrigen}_${nomOrigen}`;
                if (puntosMap.has(cacheKey)) {
                    idPuntoOrigen = puntosMap.get(cacheKey)!;
                } else {
                    let pEncontrado = await this.prisma.puntoCargaDescarga.findFirst({
                        where: {
                            OR: [
                                ...(codOrigen ? [{ codigoPuntoc: codOrigen }] : []),
                                ...(nomOrigen ? [{ nombreSede: nomOrigen }] : []),
                            ],
                        },
                        select: { idPunto: true },
                    });

                    if (!pEncontrado) {
                        pEncontrado = await this.prisma.puntoCargaDescarga.create({
                            data: {
                                idCliente,
                                codigoPuntoc: codOrigen.slice(0, 10) || 'S/C',
                                nombreSede: nomOrigen.slice(0, 100) || 'Planta Origen',
                                direccion: 'Registrado desde Manifiesto',
                                ciudad: 'Por Definir',
                                estado: 'Por Definir',
                                tipoPunto: 'Origen',
                                activo: true,
                            },
                            select: { idPunto: true },
                        });
                    }
                    idPuntoOrigen = pEncontrado.idPunto;
                    puntosMap.set(cacheKey, idPuntoOrigen);
                }
            }
            if (!idPuntoOrigen) {
                idPuntoOrigen = primerPunto?.idPunto;
            }

            // Resolver o crear punto de destino
            let idPuntoDestino = trip.destinoLlegada?.idPunto;
            const codDestino = (trip.destinoLlegada?.codigo || '').trim();
            const nomDestino = (trip.destinoLlegada?.nombre || '').trim();

            if (!idPuntoDestino && (codDestino || nomDestino)) {
                const cacheKey = `D_${codDestino}_${nomDestino}`;
                if (puntosMap.has(cacheKey)) {
                    idPuntoDestino = puntosMap.get(cacheKey)!;
                } else {
                    let pEncontrado = await this.prisma.puntoCargaDescarga.findFirst({
                        where: {
                            OR: [
                                ...(codDestino ? [{ codigoPuntoc: codDestino }] : []),
                                ...(nomDestino ? [{ nombreSede: nomDestino }] : []),
                            ],
                        },
                        select: { idPunto: true },
                    });

                    if (!pEncontrado) {
                        pEncontrado = await this.prisma.puntoCargaDescarga.create({
                            data: {
                                idCliente,
                                codigoPuntoc: codDestino.slice(0, 10) || 'S/C',
                                nombreSede: nomDestino.slice(0, 100) || 'Sede Destino',
                                direccion: 'Destino registrado desde Manifiesto',
                                ciudad: 'Por Definir',
                                estado: 'Por Definir',
                                tipoPunto: 'Destino',
                                activo: true,
                            },
                            select: { idPunto: true },
                        });
                    }
                    idPuntoDestino = pEncontrado.idPunto;
                    puntosMap.set(cacheKey, idPuntoDestino);
                }
            }
            if (!idPuntoDestino) {
                idPuntoDestino = primerPunto?.idPunto;
            }

            // Resolver o crear ruta que conecte origen y destino
            const rutaKey = `${idPuntoOrigen}_${idPuntoDestino}_${idCliente}`;
            let rutaInfo = rutasMap.get(rutaKey);

            if (!rutaInfo) {
                let rutaBd = await this.prisma.ruta.findFirst({
                    where: {
                        idPuntoOrigen,
                        idPuntoDestino,
                    },
                    select: { idRuta: true, montoTarifa: true },
                });

                if (!rutaBd) {
                    rutaBd = await this.prisma.ruta.findFirst({
                        where: { idCliente },
                        select: { idRuta: true, montoTarifa: true },
                    });
                }

                if (!rutaBd) {
                    rutaBd = await this.prisma.ruta.create({
                        data: {
                            idCliente,
                            nombreRuta: `Ruta: ${nomOrigen || 'Origen'} — ${nomDestino || 'Destino'}`.slice(0, 150),
                            ciudadOrigen: nomOrigen || 'Origen',
                            ciudadDestino: nomDestino || 'Destino',
                            idPuntoOrigen,
                            idPuntoDestino,
                            distanciaKm: 150.0,
                            montoTarifa: 0.0,
                            tipoCobro: 'Por_Viaje_Fijo',
                            moneda: 'USD',
                            activo: true,
                        },
                        select: { idRuta: true, montoTarifa: true },
                    });
                }

                rutaInfo = {
                    idRuta: rutaBd?.idRuta || primerRuta!.idRuta,
                    tarifa: Number(rutaBd?.montoTarifa || primerRuta?.montoTarifa || 0.0),
                };
                rutasMap.set(rutaKey, rutaInfo);
            }

            // Resolver vehículos si el conductor tiene asignación habitual
            let idVehiculoMotriz: string | null = trip.idVehiculoMotriz || null;
            let idAcoplado: string | null = trip.idAcoplado || null;

            if (!idVehiculoMotriz && trip.idConductor) {
                const conductor = await this.prisma.conductor.findUnique({
                    where: { idConductor: trip.idConductor },
                    select: {
                        idVehiculoHabitual: true,
                        vehiculoHabitual: {
                            select: { idAcopladoActual: true },
                        },
                    },
                });
                if (conductor?.idVehiculoHabitual) {
                    idVehiculoMotriz = conductor.idVehiculoHabitual;
                }
                if (!idAcoplado && conductor?.vehiculoHabitual?.idAcopladoActual) {
                    idAcoplado = conductor.vehiculoHabitual.idAcopladoActual;
                }
            } else if (idVehiculoMotriz && !idAcoplado) {
                const vehiculo = await this.prisma.vehicle.findUnique({
                    where: { idVehiculo: idVehiculoMotriz },
                    select: { idAcopladoActual: true },
                });
                if (vehiculo?.idAcopladoActual) {
                    idAcoplado = vehiculo.idAcopladoActual;
                }
            }

            // Inserción en guias_viajes respetando el schema Prisma
            const guiaCreada = await this.prisma.guiaViaje.create({
                data: {
                    nroTransporte: (trip.nroTransporte || '').trim(),
                    idCliente,
                    idRuta: rutaInfo.idRuta,
                    idPuntoOrigen: idPuntoOrigen!,
                    idPuntoDestino: idPuntoDestino!,
                    idVehiculoMotriz,
                    idAcoplado,
                    idConductor: trip.idConductor || null,
                    fechaProgramadaCarga: fechaCarga,
                    fechaSalidaReal: null,
                    fechaEntregaEstimada: fechaEntrega,
                    fechaEntregaReal: null,
                    moneda: 'USD',
                    montoFleteCliente: rutaInfo.tarifa,
                    montoAnticipoConductor: 0.0,
                    estadoFacturacion: 'Sin_Facturar',
                    estadoOrden: 'Programado',
                    fisico: Boolean(trip.fisico ?? false),
                    observaciones: (() => {
                        let obs = trip.observacion ?? trip.observaciones;
                        if ((!obs || !String(obs).trim()) && trip.id && String(trip.id).startsWith('manual')) {
                            obs = 'Viaje Adicional';
                        }
                        return obs && String(obs).trim() ? String(obs).trim().slice(0, 500) : null;
                    })(),
                },
                select: {
                    idOrden: true,
                    nroTransporte: true,
                    estadoOrden: true,
                    estadoFacturacion: true,
                    montoFleteCliente: true,
                    fechaProgramadaCarga: true,
                    observaciones: true,
                    fisico: true,
                },
            });

            creados.push(guiaCreada);
        }

        return {
            success: true,
            message: `Se han guardado ${creados.length} viajes en la tabla guias_viajes correctamente.`,
            guardados: creados.length,
            omitidosPorColision: rawTrips.length - creados.length,
            guias: creados,
        };
    }

    /**
     * Consulta viajes programados en la tabla guias_viajes según filtros de cliente e intervalo de fechas.
     */
    async getViajesProgramados(filter: {
        idCliente?: string;
        fechaInicio?: string;
        fechaFin?: string;
        estadoOrden?: string;
        fisico?: string | boolean;
    }) {
        const where: any = {};

        if (filter.idCliente && filter.idCliente.trim()) {
            where.idCliente = filter.idCliente.trim();
        }

        if (filter.estadoOrden && filter.estadoOrden.trim()) {
            const est = filter.estadoOrden.trim().toLowerCase();
            if (est === 'todos') {
                // Sin filtro por estadoOrden
            } else if (est === 'excluyendo_cancelados' || est === 'activos') {
                where.estadoOrden = { not: 'Cancelado' };
            } else if (est === 'programado,cancelado') {
                where.estadoOrden = { in: ['Programado', 'Cancelado'] };
            } else {
                where.estadoOrden = filter.estadoOrden.trim();
            }
        } else {
            where.estadoOrden = { in: ['Programado', 'Cancelado'] };
        }

        if (filter.fisico !== undefined && filter.fisico !== null && filter.fisico !== '') {
            where.fisico = filter.fisico === true || filter.fisico === 'true' || filter.fisico === '1';
        }

        if (filter.fechaInicio || filter.fechaFin) {
            where.fechaProgramadaCarga = {};
            if (filter.fechaInicio && filter.fechaInicio.trim()) {
                const fIni = filter.fechaInicio.trim().split(/[T\s]/)[0];
                const dInicio = new Date(`${fIni}T00:00:00.000Z`);
                where.fechaProgramadaCarga.gte = isNaN(dInicio.getTime()) ? new Date(filter.fechaInicio) : dInicio;
            }
            if (filter.fechaFin && filter.fechaFin.trim()) {
                const fFin = filter.fechaFin.trim().split(/[T\s]/)[0];
                const dFin = new Date(`${fFin}T23:59:59.999Z`);
                where.fechaProgramadaCarga.lte = isNaN(dFin.getTime()) ? new Date(filter.fechaFin) : dFin;
            }
        }

        return await this.prisma.guiaViaje.findMany({
            where,
            include: {
                cliente: {
                    select: {
                        idCliente: true,
                        razonSocial: true,
                        nombreComercial: true,
                        rif: true,
                    },
                },
                puntoOrigen: true,
                puntoDestino: true,
                ruta: {
                    include: {
                        rutaRecargos: true,
                    },
                },
                conductor: {
                    include: {
                        vehiculoHabitual: true,
                    },
                },
                vehiculoMotriz: {
                    include: {
                        clasificacion: true,
                    },
                },
                acoplado: {
                    include: {
                        clasificacion: true,
                    },
                },
                guiasViajesRecargos: {
                    include: {
                        recargo: true,
                    },
                    orderBy: {
                        fechaCreacion: 'asc',
                    },
                },
            },
            orderBy: {
                fechaProgramadaCarga: 'asc',
            },
        });
    }

    /**
     * Asigna o remueve un conductor a una orden de viaje en guias_viajes.
     * Registra automáticamente el vehículo motriz habitual y su acoplado actual (id_acoplado_actual de la tabla vehiculos).
     */
    async asignarConductor(
        idOrden: string,
        idConductor: string | null,
        idVehiculoMotrizParam?: string | null,
        idAcopladoParam?: string | null,
    ) {
        if (!idOrden) {
            throw new HttpException('idOrden es requerido', HttpStatus.BAD_REQUEST);
        }

        let idVehiculoMotriz: string | null = null;
        let idAcoplado: string | null = null;

        if (idConductor) {
            const conductor = await this.prisma.conductor.findUnique({
                where: { idConductor },
                select: {
                    idVehiculoHabitual: true,
                    vehiculoHabitual: {
                        select: {
                            idVehiculo: true,
                            idAcopladoActual: true,
                        },
                    },
                },
            });
            if (!conductor) {
                throw new HttpException(`El conductor con ID '${idConductor}' no existe en la base de datos`, HttpStatus.BAD_REQUEST);
            }
            idVehiculoMotriz = conductor.idVehiculoHabitual || idVehiculoMotrizParam || null;
            idAcoplado = conductor.vehiculoHabitual?.idAcopladoActual || idAcopladoParam || null;

            if (idVehiculoMotriz && !idAcoplado) {
                const vehiculo = await this.prisma.vehicle.findUnique({
                    where: { idVehiculo: idVehiculoMotriz },
                    select: { idAcopladoActual: true },
                });
                idAcoplado = vehiculo?.idAcopladoActual || null;
            }
        }

        try {
            return await this.prisma.guiaViaje.update({
                where: { idOrden },
                data: {
                    idConductor: idConductor || null,
                    idVehiculoMotriz,
                    idAcoplado,
                },
                include: {
                    conductor: {
                        include: {
                            vehiculoHabitual: true,
                        },
                    },
                    vehiculoMotriz: true,
                    acoplado: true,
                },
            });
        } catch (error: any) {
            throw new HttpException(
                `Error actualizando conductor en orden de viaje: ${error?.message || error}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Libera todas las asignaciones programadas de un conductor específico.
     */
    async liberarConductor(idConductor: string) {
        if (!idConductor) {
            throw new HttpException('idConductor es requerido', HttpStatus.BAD_REQUEST);
        }

        const resultado = await this.prisma.guiaViaje.updateMany({
            where: {
                idConductor,
                estadoOrden: 'Programado',
            },
            data: {
                idConductor: null,
                idVehiculoMotriz: null,
                idAcoplado: null,
            },
        });

        return { count: resultado.count };
    }

    /**
     * Actualiza las observaciones de una orden de viaje en guias_viajes.
     */
    async actualizarObservacion(idOrden: string, observaciones: string | null) {
        if (!idOrden) {
            throw new HttpException('idOrden es requerido', HttpStatus.BAD_REQUEST);
        }

        return await this.prisma.guiaViaje.update({
            where: { idOrden },
            data: {
                observaciones: observaciones && String(observaciones).trim() ? String(observaciones).trim().slice(0, 500) : null,
            },
        });
    }

    /**
     * Cancela una orden de viaje en guias_viajes estableciendo estadoOrden a Cancelado y guardando observación.
     */
    async cancelarViaje(idOrden: string, observacion?: string) {
        if (!idOrden) {
            throw new HttpException('idOrden es requerido', HttpStatus.BAD_REQUEST);
        }

        const guia = await this.prisma.guiaViaje.findUnique({
            where: { idOrden },
        });

        if (!guia) {
            throw new HttpException('La orden de viaje no existe.', HttpStatus.NOT_FOUND);
        }

        const obsActual = guia.observaciones ? guia.observaciones.trim() : '';
        const obsMotivo = observacion && observacion.trim() ? observacion.trim() : 'Cancelado desde consola de asignación';
        const nuevaObservacion = obsActual && !obsActual.startsWith(obsMotivo)
            ? `${obsMotivo} | Previo: ${obsActual}`.slice(0, 500)
            : obsMotivo.slice(0, 500);

        return await this.prisma.guiaViaje.update({
            where: { idOrden },
            data: {
                estadoOrden: 'Cancelado',
                observaciones: nuevaObservacion,
                idConductor: null,
                idVehiculoMotriz: null,
                idAcoplado: null,
            },
        });
    }

    /**
     * Actualiza el estado fisico de una orden de viaje en guias_viajes (documento fisico recibido).
     */
    async actualizarFisico(idOrden: string, fisico: boolean) {
        if (!idOrden) {
            throw new HttpException('idOrden es requerido', HttpStatus.BAD_REQUEST);
        }

        const guia = await this.prisma.guiaViaje.findUnique({
            where: { idOrden },
            select: { idOrden: true },
        });

        if (!guia) {
            throw new HttpException(`La orden de viaje con ID '${idOrden}' no existe.`, HttpStatus.NOT_FOUND);
        }

        return await this.prisma.guiaViaje.update({
            where: { idOrden },
            data: {
                fisico: Boolean(fisico),
            },
        });
    }

    /**
     * Asigna o actualiza recursos (vehículo motriz / chuto, acoplado / batea, conductor) a un viaje.
     */
    async asignarRecursos(body: {
        idOrden: string;
        idVehiculoMotriz?: string | null;
        idAcoplado?: string | null;
        idConductor?: string | null;
    }) {
        const { idOrden, idVehiculoMotriz, idAcoplado, idConductor } = body;
        if (!idOrden) {
            throw new HttpException('idOrden es requerido', HttpStatus.BAD_REQUEST);
        }

        const guia = await this.prisma.guiaViaje.findUnique({ where: { idOrden } });
        if (!guia) {
            throw new HttpException('Orden de viaje no encontrada', HttpStatus.NOT_FOUND);
        }

        const data: any = {};
        if (idVehiculoMotriz !== undefined) data.idVehiculoMotriz = idVehiculoMotriz || null;
        if (idAcoplado !== undefined) data.idAcoplado = idAcoplado || null;
        if (idConductor !== undefined) data.idConductor = idConductor || null;

        if (idConductor !== undefined) {
            if (data.idConductor) {
                const conductor = await this.prisma.conductor.findUnique({
                    where: { idConductor: data.idConductor },
                    select: {
                        idVehiculoHabitual: true,
                        vehiculoHabitual: {
                            select: { idAcopladoActual: true },
                        },
                    },
                });
                if (idVehiculoMotriz === undefined) {
                    data.idVehiculoMotriz = conductor?.idVehiculoHabitual || null;
                }
                if (idAcoplado === undefined) {
                    data.idAcoplado = conductor?.vehiculoHabitual?.idAcopladoActual || null;
                }
            } else {
                if (idVehiculoMotriz === undefined) data.idVehiculoMotriz = null;
                if (idAcoplado === undefined) data.idAcoplado = null;
            }
        } else if (data.idVehiculoMotriz && idAcoplado === undefined) {
            const vehiculo = await this.prisma.vehicle.findUnique({
                where: { idVehiculo: data.idVehiculoMotriz },
                select: { idAcopladoActual: true },
            });
            data.idAcoplado = vehiculo?.idAcopladoActual || null;
        }

        return await this.prisma.guiaViaje.update({
            where: { idOrden },
            data,
            include: {
                cliente: true,
                puntoOrigen: true,
                puntoDestino: true,
                ruta: { include: { rutaRecargos: true } },
                conductor: { include: { vehiculoHabitual: true } },
                vehiculoMotriz: { include: { clasificacion: true } },
                acoplado: { include: { clasificacion: true } },
                guiasViajesRecargos: { include: { recargo: true } },
            },
        });
    }

    /**
     * Genera la plancha agregando un viaje de retorno debajo del viaje inicial,
     * permitiendo cambiar el punto de regreso y solicitando el ingreso de nro de transporte.
     */
    async crearViajeRetorno(data: {
        idOrdenOrigen: string;
        nroTransporte: string;
        idPuntoDestino?: string;
        fechaProgramadaCarga?: string;
        montoFlete?: number;
        observaciones?: string;
    }) {
        const { idOrdenOrigen, nroTransporte, idPuntoDestino, fechaProgramadaCarga, montoFlete, observaciones } = data;

        if (!idOrdenOrigen || !nroTransporte || !nroTransporte.trim()) {
            throw new HttpException('idOrdenOrigen y nroTransporte son obligatorios para generar la plancha de retorno', HttpStatus.BAD_REQUEST);
        }

        const guiaOriginal = await this.prisma.guiaViaje.findUnique({
            where: { idOrden: idOrdenOrigen },
            include: { puntoOrigen: true, puntoDestino: true },
        });

        if (!guiaOriginal) {
            throw new HttpException('La orden de viaje inicial no existe', HttpStatus.NOT_FOUND);
        }

        const nroTrim = nroTransporte.trim();
        const yaExiste = await this.prisma.guiaViaje.findUnique({
            where: { nroTransporte: nroTrim },
        });
        if (yaExiste) {
            throw new HttpException(`El Nº de Transporte '${nroTrim}' ya está registrado. Ingrese un número distinto.`, HttpStatus.CONFLICT);
        }

        // Origen del retorno (B) = Destino del viaje original
        const origenRetorno = guiaOriginal.idPuntoDestino;
        // Destino del retorno (C) = Seleccionado o por defecto el Origen del viaje original
        const destinoRetorno = (idPuntoDestino && idPuntoDestino.trim()) || guiaOriginal.idPuntoOrigen;

        // Buscar primero la ruta en sentido contrario (C -> B) que es la registrada en la tabla rutas
        const rutaContraria = await this.prisma.ruta.findFirst({
            where: {
                idPuntoOrigen: destinoRetorno,
                idPuntoDestino: origenRetorno,
            },
            orderBy: { activo: 'desc' },
        });

        // Buscar si existe ruta directa (B -> C) o usar la ruta contraria (C -> B) registrada
        let rutaRetorno =
            rutaContraria ||
            (await this.prisma.ruta.findFirst({
                where: {
                    idPuntoOrigen: origenRetorno,
                    idPuntoDestino: destinoRetorno,
                },
            }));

        const tarifaSegunRuta =
            rutaContraria?.montoTarifa !== undefined && rutaContraria?.montoTarifa !== null
                ? Number(rutaContraria.montoTarifa)
                : rutaRetorno?.montoTarifa !== undefined && rutaRetorno?.montoTarifa !== null
                    ? Number(rutaRetorno.montoTarifa)
                    : Number(guiaOriginal.montoFleteCliente || 0);

        const montoFleteFinal =
            montoFlete !== undefined && montoFlete !== null && !isNaN(Number(montoFlete))
                ? Number(montoFlete)
                : tarifaSegunRuta;

        if (!rutaRetorno) {
            const pOrig = await this.prisma.puntoCargaDescarga.findUnique({ where: { idPunto: origenRetorno } });
            const pDest = await this.prisma.puntoCargaDescarga.findUnique({ where: { idPunto: destinoRetorno } });

            rutaRetorno = await this.prisma.ruta.create({
                data: {
                    idCliente: guiaOriginal.idCliente,
                    nombreRuta: `Retorno: ${pOrig?.nombreSede || 'Origen'} — ${pDest?.nombreSede || 'Destino'}`.slice(0, 150),
                    ciudadOrigen: pOrig?.ciudad || 'Origen',
                    ciudadDestino: pDest?.ciudad || 'Destino',
                    idPuntoOrigen: origenRetorno,
                    idPuntoDestino: destinoRetorno,
                    distanciaKm: 150.0,
                    montoTarifa: montoFleteFinal,
                    tipoCobro: 'Por_Viaje_Fijo',
                    moneda: 'USD',
                    activo: true,
                },
            });
        }

        // Tomar exactamente la misma fecha_programada_carga del viaje inicial para todos los campos de fecha de la plancha
        const fechaBaseViaje = guiaOriginal.fechaProgramadaCarga
            ? new Date(guiaOriginal.fechaProgramadaCarga)
            : fechaProgramadaCarga
                ? new Date(fechaProgramadaCarga)
                : new Date();
        const fechaMismaViaje = isNaN(fechaBaseViaje.getTime()) ? new Date() : fechaBaseViaje;

        const retObsTag = `[RETORNO_DE:${guiaOriginal.idOrden}]`;
        const obsLimpia = observaciones ? observaciones.replace(/^\[RETORNO_DE:[^\]]+\]\s*/i, '').trim() : '';
        const finalObs = obsLimpia
            ? `${retObsTag} ${obsLimpia}`
            : `${retObsTag} Plancha de Retorno (Guía Inicial: ${guiaOriginal.nroTransporte || guiaOriginal.idOrden})`;

        return await this.prisma.guiaViaje.create({
            data: {
                nroTransporte: nroTrim,
                idCliente: guiaOriginal.idCliente,
                idRuta: rutaRetorno.idRuta,
                idPuntoOrigen: origenRetorno,
                idPuntoDestino: destinoRetorno,
                idVehiculoMotriz: guiaOriginal.idVehiculoMotriz,
                idAcoplado: guiaOriginal.idAcoplado,
                idConductor: guiaOriginal.idConductor,
                fechaProgramadaCarga: fechaMismaViaje,
                fechaSalidaReal: fechaMismaViaje,
                fechaEntregaEstimada: fechaMismaViaje,
                fechaEntregaReal: fechaMismaViaje,
                moneda: 'USD',
                montoFleteCliente: montoFleteFinal,
                montoAnticipoConductor: 0,
                estadoFacturacion: 'Sin_Facturar',
                estadoOrden: 'Programado',
                fisico: false,
                observaciones: finalObs,
            },
            include: {
                cliente: true,
                puntoOrigen: true,
                puntoDestino: true,
                ruta: { include: { rutaRecargos: true } },
                conductor: { include: { vehiculoHabitual: true } },
                vehiculoMotriz: { include: { clasificacion: true } },
                acoplado: { include: { clasificacion: true } },
                guiasViajesRecargos: { include: { recargo: true } },
            },
        });
    }

    /**
     * Actualiza los datos de una plancha de retorno existente en guias_viajes,
     * recalculando la ruta y tarifa a partir de la ruta inversa (C -> B) si cambia el destino.
     */
    async actualizarViajeRetorno(data: {
        idOrden: string;
        nroTransporte: string;
        idPuntoDestino?: string;
        montoFlete?: number;
        observaciones?: string;
    }) {
        const { idOrden, nroTransporte, idPuntoDestino, montoFlete, observaciones } = data;

        if (!idOrden || !nroTransporte || !nroTransporte.trim()) {
            throw new HttpException('idOrden y nroTransporte son obligatorios para editar la plancha de retorno', HttpStatus.BAD_REQUEST);
        }

        const guiaPlancha = await this.prisma.guiaViaje.findUnique({
            where: { idOrden },
        });

        if (!guiaPlancha) {
            throw new HttpException('La plancha de retorno no existe', HttpStatus.NOT_FOUND);
        }

        const nroTrim = nroTransporte.trim();
        const colision = await this.prisma.guiaViaje.findFirst({
            where: {
                nroTransporte: nroTrim,
                NOT: { idOrden },
            },
        });

        if (colision) {
            throw new HttpException(`El Nº de Transporte '${nroTrim}' ya está registrado en otra guía.`, HttpStatus.CONFLICT);
        }

        const origenRetorno = guiaPlancha.idPuntoOrigen;
        const destinoRetorno = (idPuntoDestino && idPuntoDestino.trim()) || guiaPlancha.idPuntoDestino;

        // Buscar la ruta contraria (C -> B) registrada en la tabla rutas
        const rutaContraria = await this.prisma.ruta.findFirst({
            where: {
                idPuntoOrigen: destinoRetorno,
                idPuntoDestino: origenRetorno,
            },
            orderBy: { activo: 'desc' },
        });

        let rutaRetorno =
            rutaContraria ||
            (await this.prisma.ruta.findFirst({
                where: {
                    idPuntoOrigen: origenRetorno,
                    idPuntoDestino: destinoRetorno,
                },
            }));

        const tarifaSegunRuta =
            rutaContraria?.montoTarifa !== undefined && rutaContraria?.montoTarifa !== null
                ? Number(rutaContraria.montoTarifa)
                : rutaRetorno?.montoTarifa !== undefined && rutaRetorno?.montoTarifa !== null
                    ? Number(rutaRetorno.montoTarifa)
                    : Number(guiaPlancha.montoFleteCliente || 0);

        const montoFleteFinal =
            montoFlete !== undefined && montoFlete !== null && !isNaN(Number(montoFlete))
                ? Number(montoFlete)
                : tarifaSegunRuta;

        const idRutaFinal = rutaRetorno ? rutaRetorno.idRuta : guiaPlancha.idRuta;

        // Preservar la etiqueta [RETORNO_DE:...] del viaje padre en las observaciones
        const matchTag = (guiaPlancha.observaciones || '').match(/^(\[RETORNO_DE:[^\]]+\])/);
        const retObsTag = matchTag ? matchTag[1] : '[RETORNO]';
        const obsLimpia = observaciones !== undefined
            ? observaciones.replace(/^\[RETORNO_DE:[^\]]+\]\s*/i, '').trim()
            : (guiaPlancha.observaciones || '').replace(/^\[RETORNO_DE:[^\]]+\]\s*/i, '').trim();
        const finalObs = obsLimpia ? `${retObsTag} ${obsLimpia}` : `${retObsTag} Plancha de Retorno`;

        return await this.prisma.guiaViaje.update({
            where: { idOrden },
            data: {
                nroTransporte: nroTrim,
                idPuntoDestino: destinoRetorno,
                idRuta: idRutaFinal,
                montoFleteCliente: montoFleteFinal,
                observaciones: finalObs,
            },
            include: {
                cliente: true,
                puntoOrigen: true,
                puntoDestino: true,
                ruta: { include: { rutaRecargos: true } },
                conductor: { include: { vehiculoHabitual: true } },
                vehiculoMotriz: { include: { clasificacion: true } },
                acoplado: { include: { clasificacion: true } },
                guiasViajesRecargos: { include: { recargo: true } },
            },
        });
    }

    /**
     * Obtiene los recargos asignados a un viaje desde la tabla guias_viajes_recargos.
     */
    async getRecargosViaje(idOrden: string) {
        if (!idOrden) {
            throw new HttpException('idOrden es requerido', HttpStatus.BAD_REQUEST);
        }

        return await this.prisma.guiaViajeRecargo.findMany({
            where: { idOrden },
            include: {
                recargo: true,
            },
            orderBy: {
                fechaCreacion: 'asc',
            },
        });
    }

    /**
     * Sincroniza / guarda los recargos asignados a un viaje en la tabla guias_viajes_recargos.
     */
    async guardarRecargosViaje(
        idOrden: string,
        recargos: Array<{
            idViajeRecargo?: string;
            idRecargo?: string | null;
            concepto?: string;
            monto: number | string;
            moneda?: 'Bs' | 'USD';
            observaciones?: string | null;
            estado?: 'Pendiente' | 'Procesado' | 'Rechazado';
        }>,
    ) {
        if (!idOrden) {
            throw new HttpException('idOrden es requerido', HttpStatus.BAD_REQUEST);
        }

        const viaje = await this.prisma.guiaViaje.findUnique({
            where: { idOrden },
            include: { ruta: true },
        });

        if (!viaje) {
            throw new HttpException('Orden de viaje no encontrada', HttpStatus.NOT_FOUND);
        }

        return await this.prisma.$transaction(async (tx) => {
            // Eliminar registros actuales para sincronizar la nueva lista completa
            await tx.guiaViajeRecargo.deleteMany({
                where: { idOrden },
            });

            if (Array.isArray(recargos) && recargos.length > 0) {
                for (const r of recargos) {
                    let idRecargoToUse = r.idRecargo || null;
                    const montoVal = Number(r.monto) || 0;

                    // Verificar si idRecargoToUse existe en rutas_recargos (ya que puede provenir de recargos_generales)
                    if (idRecargoToUse) {
                        const existeEnRuta = await tx.rutaRecargo.findUnique({
                            where: { idRecargo: idRecargoToUse },
                            select: { idRecargo: true },
                        });
                        if (!existeEnRuta) {
                            idRecargoToUse = null;
                        }
                    }

                    // Si se suministró concepto y no existe aún en rutas_recargos, buscar o vincular en rutas_recargos
                    if (!idRecargoToUse && r.concepto && r.concepto.trim() && viaje.idRuta) {
                        let rutaRec = await tx.rutaRecargo.findFirst({
                            where: {
                                idRuta: viaje.idRuta,
                                concepto: { equals: r.concepto.trim() },
                            },
                        });

                        if (!rutaRec) {
                            rutaRec = await tx.rutaRecargo.create({
                                data: {
                                    idRuta: viaje.idRuta,
                                    concepto: r.concepto.trim(),
                                    tipoCalculo: 'Monto_Fijo',
                                    valor: montoVal,
                                    moneda: r.moneda === 'Bs' ? 'Bs' : 'USD',
                                },
                            });
                        }
                        idRecargoToUse = rutaRec.idRecargo;
                    }

                    await tx.guiaViajeRecargo.create({
                        data: {
                            idOrden,
                            idRecargo: idRecargoToUse,
                            monto: montoVal,
                            estado: r.estado || 'Pendiente',
                            observaciones: r.observaciones ? String(r.observaciones).trim() : null,
                        },
                    });
                }
            }

            return await tx.guiaViajeRecargo.findMany({
                where: { idOrden },
                include: {
                    recargo: true,
                },
                orderBy: {
                    fechaCreacion: 'asc',
                },
            });
        });
    }

    /**
     * Elimina un recargo individual de guias_viajes_recargos.
     */
    async eliminarRecargoViaje(idViajeRecargo: string) {
        if (!idViajeRecargo) {
            throw new HttpException('idViajeRecargo es requerido', HttpStatus.BAD_REQUEST);
        }

        return await this.prisma.guiaViajeRecargo.delete({
            where: { idViajeRecargo },
        });
    }

    /**
     * Catálogo combinado de recargos disponibles (de rutas_recargos y recargos_generales).
     */
    async getCatalogoRecargos(idRuta?: string) {
        const [generales, deRuta] = await Promise.all([
            this.prisma.recargoGeneral.findMany({ orderBy: { concepto: 'asc' } }),
            idRuta ? this.prisma.rutaRecargo.findMany({ where: { idRuta }, orderBy: { concepto: 'asc' } }) : Promise.resolve([]),
        ]);

        return {
            generales,
            deRuta,
        };
    }
}