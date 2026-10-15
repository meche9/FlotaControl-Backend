import { Module } from '@nestjs/common';
import { RutasService } from './rutas.service.js';
import { RutasController } from './rutas.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [RutasController],
  providers: [RutasService],
  exports: [RutasService],
})
export class RutasModule {}

