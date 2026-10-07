import { Module } from '@nestjs/common';
import { ConductoresService } from '../conductores/conductores.service.js';
import { ConductoresController } from '../conductores/conductores.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ImagenesModule } from '../imagenes/imagenes.module.js';

@Module({
  imports: [PrismaModule, ImagenesModule],
  controllers: [ConductoresController],
  providers: [ConductoresService],
})
export class ConductoresModule {}