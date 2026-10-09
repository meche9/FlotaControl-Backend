import { Module } from '@nestjs/common';
import { PuntosCargaService } from './puntosCargasDescargas.service.js';
import { PuntosCargaController } from './puntosCargasDescargas.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
    imports: [PrismaModule],
    controllers: [PuntosCargaController],
    providers: [PuntosCargaService],
    exports: [PuntosCargaService],
})
export class PuntosCargaModule { }