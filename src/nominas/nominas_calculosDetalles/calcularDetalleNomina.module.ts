import { Module } from '@nestjs/common';
import { CalcularDetalleNominaController } from './calcularDetalleNomina.controller.js';
import { CalcularDetalleNominaService } from './calcularDetalleNomina.service.js';

@Module({
    controllers: [CalcularDetalleNominaController],
    providers: [CalcularDetalleNominaService],
    exports: [CalcularDetalleNominaService],
})
export class CalcularDetalleNominaModule { }