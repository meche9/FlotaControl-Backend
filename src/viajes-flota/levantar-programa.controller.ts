import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
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
    async asignarConductor(
        @Body()
        body: {
            idOrden: string;
            idConductor: string | null;
            idVehiculoMotriz?: string | null;
            idAcoplado?: string | null;
        },
    ) {
        return await this.levantarProgramaService.asignarConductor(
            body.idOrden,
            body.idConductor,
            body.idVehiculoMotriz,
            body.idAcoplado,
        );
    }

    @Patch('asignar-recursos')
    async asignarRecursos(@Body() body: {
        idOrden: string;
        idVehiculoMotriz?: string | null;
        idAcoplado?: string | null;
        idConductor?: string | null;
    }) {
        return await this.levantarProgramaService.asignarRecursos(body);
    }

    @Post('crear-retorno')
    async crearViajeRetorno(@Body() body: {
        idOrdenOrigen: string;
        nroTransporte: string;
        idPuntoDestino?: string;
        fechaProgramadaCarga?: string;
        montoFlete?: number;
        observaciones?: string;
    }) {
        return await this.levantarProgramaService.crearViajeRetorno(body);
    }

    @Patch('actualizar-retorno')
    async actualizarViajeRetorno(@Body() body: {
        idOrden: string;
        nroTransporte: string;
        idPuntoDestino?: string;
        montoFlete?: number;
        observaciones?: string;
    }) {
        return await this.levantarProgramaService.actualizarViajeRetorno(body);
    }

    @Get('recargos-catalogo')
    async getCatalogoRecargos(@Query('idRuta') idRuta?: string) {
        return await this.levantarProgramaService.getCatalogoRecargos(idRuta);
    }

    @Get(':idOrden/recargos')
    async getRecargosViaje(@Param('idOrden') idOrden: string) {
        return await this.levantarProgramaService.getRecargosViaje(idOrden);
    }

    @Post(':idOrden/recargos')
    async guardarRecargosViaje(
        @Param('idOrden') idOrden: string,
        @Body() body: {
            recargos: Array<{
                idViajeRecargo?: string;
                idRecargo?: string | null;
                concepto?: string;
                monto: number | string;
                observaciones?: string | null;
                estado?: 'Pendiente' | 'Procesado' | 'Rechazado';
            }>;
        },
    ) {
        return await this.levantarProgramaService.guardarRecargosViaje(idOrden, body.recargos || []);
    }

    @Delete('recargos/:idViajeRecargo')
    async eliminarRecargoViaje(@Param('idViajeRecargo') idViajeRecargo: string) {
        return await this.levantarProgramaService.eliminarRecargoViaje(idViajeRecargo);
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