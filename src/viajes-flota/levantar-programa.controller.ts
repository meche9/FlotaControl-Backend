import {
    Controller,
    Get,
    Post,
    Patch,
    Query,
    Param,
    Body,
    UseInterceptors,
    UploadedFile,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LevantarProgramaService } from './levantar-programa.service.js';

@Controller('schedules')
export class LevantarProgramaController {
    constructor(private readonly levantarProgramaService: LevantarProgramaService) { }

    @Post('preview')
    @UseInterceptors(FileInterceptor('file'))
    async previewSchedule(@UploadedFile() file: any) {
        if (!file) {
            throw new HttpException('No se ha adjuntado ningún archivo.', HttpStatus.BAD_REQUEST);
        }

        const filename = (file.originalname || '').toLowerCase();
        const isPdf = filename.endsWith('.pdf') || file.mimetype === 'application/pdf';

        if (!isPdf) {
            throw new HttpException('El archivo adjunto debe ser de formato PDF (.pdf).', HttpStatus.BAD_REQUEST);
        }

        return await this.levantarProgramaService.getSchedulePreview(file);
    }

    @Post('confirm')
    async confirmSchedule(@Body() data: any) {
        return await this.levantarProgramaService.saveConfirmedSchedule(data);
    }

    @Get('programados')
    async getViajesProgramados(
        @Query('idCliente') idCliente?: string,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string,
        @Query('estadoOrden') estadoOrden?: string,
        @Query('fisico') fisico?: string,
    ) {
        return await this.levantarProgramaService.getViajesProgramados({
            idCliente,
            fechaInicio,
            fechaFin,
            estadoOrden,
            fisico,
        });
    }

    @Patch('asignar-conductor')
    async asignarConductor(@Body() body: { idOrden: string; idConductor: string | null }) {
        return await this.levantarProgramaService.asignarConductor(body.idOrden, body.idConductor);
    }

    @Patch('liberar-conductor/:idConductor')
    async liberarConductor(@Param('idConductor') idConductor: string) {
        return await this.levantarProgramaService.liberarConductor(idConductor);
    }

    @Patch('actualizar-observacion')
    async actualizarObservacion(@Body() body: { idOrden: string; observaciones: string | null }) {
        return await this.levantarProgramaService.actualizarObservacion(body.idOrden, body.observaciones);
    }

    @Patch('actualizar-fisico')
    async actualizarFisico(@Body() body: { idOrden: string; fisico: boolean }) {
        return await this.levantarProgramaService.actualizarFisico(body.idOrden, body.fisico);
    }

    @Patch('cancelar-viaje')
    async cancelarViaje(@Body() body: { idOrden: string; observacion?: string }) {
        return await this.levantarProgramaService.cancelarViaje(body.idOrden, body.observacion);
    }
}