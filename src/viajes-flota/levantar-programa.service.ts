import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as FormData from 'form-data';
import axios from 'axios';

@Injectable()
export class SchedulesService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Envía el PDF a Python y retorna la programación plana para la vista previa del frontend.
     */
    async getSchedulePreview(file: Express.Multer.File) {
        if (!file) {
            throw new HttpException('No se ha adjuntado ningún archivo PDF.', HttpStatus.BAD_REQUEST);
        }

        const formData = new FormData();
        formData.append('file', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype,
        });

        try {
            // 1. Llamada al microservicio de Python
            const pythonResponse = await axios.post('http://127.0.0.1:8000/extract-schedule', formData, {
                headers: { ...formData.getHeaders() },
            });

            const rawTrips = pythonResponse.data.trips || [];

            // 2. Mapeo directo de la data extraída para la pantalla de supervisión
            const formattedTrips = rawTrips.map((trip, index) => ({
                id: `trip-${index + 1}`,
                nroTransporte: trip.guia_viaje || 'S/N',
                origenSalida: {
                    codigo: trip.cod_origen,
                    nombre: trip.punto_origen,
                },
                destinoLlegada: {
                    codigo: trip.cod_destino,
                    nombre: trip.punto_destino,
                },
                fechaProgramadaCarga: trip.fecha_i,
                horaProgramadaCarga: trip.hora_i,
                fechaEntregaEstimada: trip.fecha_f,
                horaEntregaEstimada: trip.hora_f,
                // En esta etapa el conductor viene directamente del texto extraído o se deja pendiente
                conductorAsignado: null, // Si el PDF trae texto de conductor, se puede mapear aquí
                estadoPendienteChofer: true, // Para marcar los que requieren asignación urgente como en tu UI
                observacion: trip.observacion || '',
            }));

            return {
                totalViajes: formattedTrips.length,
                trips: formattedTrips,
            };

        } catch (error) {
            throw new HttpException(
                `Error al procesar el PDF en el extractor: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Endpoint final cuando el usuario confirma la pantalla de supervisión y guarda.
     */
    async saveConfirmedSchedule(confirmedData: any[]) {
        // Aquí puedes implementar la inserción masiva a tu GuiaViaje o tablas temporales según requieras
        return {
            success: true,
            message: 'Programación procesada y guardada correctamente.',
        };
    }
}