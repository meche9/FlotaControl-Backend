import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CalcularDetalleNominaService } from './calcularDetalleNomina.service.js';
import { CalcularDetalleNominaDto } from './dto/calcular-detalle-nomina.dto.js';

@Controller('calcular-detalle-nomina')
export class CalcularDetalleNominaController {
    constructor(
        private readonly calcularDetalleNominaService: CalcularDetalleNominaService,
    ) { }

    @Post()
    async calcular(@Body() dto: CalcularDetalleNominaDto) {
        return await this.calcularDetalleNominaService.calcularDetalleNomina(dto);
    }

    @Get(':idProcesonomina')
    async listarDetalles(
        @Param('idProcesonomina') idProcesonomina: string,
        @Query('idConductor') idConductor?: string,
    ) {
        return await this.calcularDetalleNominaService.obtenerDetalles(
            idProcesonomina,
            idConductor,
        );
    }
}