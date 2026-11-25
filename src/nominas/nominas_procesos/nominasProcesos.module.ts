// nominasProcesos.module.ts
import { Module } from '@nestjs/common';
import { NominasProcesosController } from './nominasProcesos.controller.js';
import { NominasProcesosService } from './nominasProcesos.service.js';

@Module({
    controllers: [NominasProcesosController],
    providers: [NominasProcesosService],
    exports: [NominasProcesosService],
})
export class NominasProcesosModule { }