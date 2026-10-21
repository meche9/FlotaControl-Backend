import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LevantarProgramaController } from './levantar-programa.controller.js';
import { LevantarProgramaService } from './levantar-programa.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [LevantarProgramaController],
  providers: [LevantarProgramaService],
  exports: [LevantarProgramaService],
})
export class ViajesFlotaModule {}
