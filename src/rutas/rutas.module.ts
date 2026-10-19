import { Module } from '@nestjs/common';
import { RutasService } from './rutas.service.js';
import { RutasController } from './rutas.controller.js';
import { PeajesModule } from './peajes/peajes.module.js';
import { RecargosModule } from './recargos/recargos.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, PeajesModule, RecargosModule],
  controllers: [RutasController],
  providers: [RutasService],
  exports: [RutasService, PeajesModule, RecargosModule],
})
export class RutasModule {}

