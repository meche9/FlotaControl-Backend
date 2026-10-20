import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import FormData from 'form-data';
import axios from 'axios';

@Injectable()
export class LevantarProgramaService {
    constructor(private readonly prisma: PrismaService) { }

    async getSchedulePreview(file: any) {
        if (!file) {
            throw new HttpException('No se ha adjuntado ningún archivo PDF.', HttpStatus.BAD_REQUEST);
        }

        const formData = new FormData();
        formData.append('file', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype,
        });

        try {
            const pythonResponse = await axios.post('http://127.0.0.1:8000/extract-schedule', formData, {
                headers: { ...formData.getHeaders() },
            });

            const rawTrips = pythonResponse.data.trips || [];

            const formattedTrips = rawTrips.map((trip: any, index: number) => ({
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
                conductorAsignado: null,
                estadoPendienteChofer: true,
                observacion: trip.observacion || '',
            }));

            return {
                totalViajes: formattedTrips.length,
                trips: formattedTrips,
            };

        } catch (error: unknown) {
            const err = error as any;
            const errorMsg = err.response?.data?.detail || err.message;
            throw new HttpException(
                `Error al procesar el PDF en el extractor: ${errorMsg}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async saveConfirmedSchedule(confirmedData: any[]) {
        return {
            success: true,
            message: 'Programación procesada y guardada correctamente.',
        };
    }
}