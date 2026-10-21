import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import FormData from 'form-data';
import axios from 'axios';

@Injectable()
export class LevantarProgramaService {
    constructor(private readonly prisma: PrismaService) { }

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

        try {
            const pythonResponse = await axios.post('http://127.0.0.1:8000/extract-schedule', formData, {
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
        for (const p of puntosBd) {
            if (p.codigoPuntoc) {
                puntosPorCodigo.set(p.codigoPuntoc.trim().toUpperCase(), p);
            }
        }

        // 4. Mapear y formatear cada viaje con verificación de colisión
        const formattedTrips = rawTrips.map((trip: any, index: number) => {
            const nroGuia = (trip.guia_viaje || `TR-AUTO-${Date.now().toString().slice(-4)}-${index + 1}`).trim();
            const nroKey = nroGuia.toUpperCase();
            const colisionEncontrada = guiasMap.get(nroKey);
            const yaExiste = Boolean(colisionEncontrada);

            const codOrigen = (trip.cod_origen || '').trim();
            const codDestino = (trip.cod_destino || '').trim();

            const puntoOrigenBd = puntosPorCodigo.get(codOrigen.toUpperCase());
            const puntoDestinoBd = puntosPorCodigo.get(codDestino.toUpperCase());

            // Código de retorno sugerido
            const nroDigitos = nroGuia.replace(/[^0-9]/g, '').slice(-4) || String(9000 + index);
            const nroRetornoSugerido = `RET-${nroDigitos}-A`;

            return {
                id: `trip-${randomUUID()}`,
                nroTransporte: nroGuia,
                origenSalida: {
                    codigo: codOrigen || (puntoOrigenBd ? puntoOrigenBd.codigoPuntoc : 'S/C'),
                    nombre: trip.punto_origen || (puntoOrigenBd ? puntoOrigenBd.nombreSede : 'Origen'),
                    idPunto: puntoOrigenBd ? puntoOrigenBd.idPunto : null,
                    idCliente: puntoOrigenBd ? puntoOrigenBd.idCliente : null,
                },
                destinoLlegada: {
                    codigo: codDestino || (puntoDestinoBd ? puntoDestinoBd.codigoPuntoc : 'S/C'),
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
                // Bandera de verificación de existencia en guias_viajes
                yaExiste,
                colision: yaExiste,
                colisionDetalle: colisionEncontrada
                    ? {
                          idOrden: colisionEncontrada.idOrden,
                          estadoOrden: colisionEncontrada.estadoOrden,
                          fechaProgramadaCarga: colisionEncontrada.fechaProgramadaCarga,
                          conductorAsignado: colisionEncontrada.conductor
                              ? `${colisionEncontrada.conductor.nombres} ${colisionEncontrada.conductor.apellidos}`
                              : null,
                      }
                    : null,
            };
        });

        // 5. Ordenar cronológicamente por fechaProgramadaCarga y horaProgramadaCarga
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
        const [primerCliente, primerPunto, primerRuta] = await Promise.all([
            this.prisma.cliente.findFirst({ select: { idCliente: true } }),
            this.prisma.puntoCargaDescarga.findFirst({ select: { idPunto: true, idCliente: true } }),
            this.prisma.ruta.findFirst({ select: { idRuta: true } }),
        ]);

        const idClienteFallback = primerPunto?.idCliente || primerCliente?.idCliente;
        if (!idClienteFallback) {
            throw new HttpException(
                'No se puede registrar viajes en guias_viajes sin al menos un Cliente registrado en el sistema.',
                HttpStatus.PRECONDITION_FAILED,
            );
        }

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
                        const d = new Date(year, month, day, hours, minutes);
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
            const fechaEntrega = parseDate(trip.fechaEntregaEstimada || trip.fechaProgramadaCarga, trip.horaEntregaEstimada || '18:00');

            const idPuntoOrigen = trip.origenSalida?.idPunto || primerPunto?.idPunto;
            const idPuntoDestino = trip.destinoLlegada?.idPunto || primerPunto?.idPunto;
            const idCliente = trip.origenSalida?.idCliente || idClienteFallback;

            // Buscar ruta existente que conecte estos puntos o usar primerRuta
            let idRuta = primerRuta?.idRuta;
            if (idPuntoOrigen && idPuntoDestino) {
                const rutaCoincidente = await this.prisma.ruta.findFirst({
                    where: {
                        idPuntoOrigen,
                        idPuntoDestino,
                    },
                    select: { idRuta: true },
                });
                if (rutaCoincidente) {
                    idRuta = rutaCoincidente.idRuta;
                }
            }

            if (!idRuta || !idPuntoOrigen || !idPuntoDestino) {
                // Si aún falta una ruta, buscamos cualquier ruta existente del cliente
                const rutaCualquiera = await this.prisma.ruta.findFirst({ select: { idRuta: true } });
                idRuta = rutaCualquiera?.idRuta;
            }

            if (!idRuta) {
                throw new HttpException(
                    'Se requiere tener al menos una Ruta registrada en el sistema para asociar las guías de viaje.',
                    HttpStatus.PRECONDITION_FAILED,
                );
            }

            const guiaCreada = await this.prisma.guiaViaje.create({
                data: {
                    nroTransporte: (trip.nroTransporte || '').trim(),
                    idCliente,
                    idRuta,
                    idPuntoOrigen,
                    idPuntoDestino,
                    idConductor: trip.idConductor || null,
                    fechaProgramadaCarga: fechaCarga,
                    fechaEntregaEstimada: fechaEntrega,
                    moneda: 'USD',
                    montoFleteCliente: 0.0,
                    montoAnticipoConductor: 0.0,
                    estadoFacturacion: 'Sin_Facturar',
                    estadoOrden: 'Programado',
                    observaciones: trip.observacion || `Levantado automáticamente desde programa PDF. Retorno: ${trip.nroRetorno || ''}`,
                },
                select: {
                    idOrden: true,
                    nroTransporte: true,
                    estadoOrden: true,
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
}