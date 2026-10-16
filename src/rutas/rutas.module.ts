import { Module } from '@nestjs/common';
import { RutasService } from './rutas.service.js';
import { RutasController } from './rutas.controller.js';
import { PeajesModule } from './peajes/peajes.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, PeajesModule],
  controllers: [RutasController],
  providers: [RutasService],
  exports: [RutasService, PeajesModule],
})
export class RutasModule {}

