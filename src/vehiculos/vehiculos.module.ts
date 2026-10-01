import { Module } from '@nestjs/common';

import { VehiculosService } from '../vehiculos/vehiculos.service.js';
import { VehiculosController } from '../vehiculos/vehiculos.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ImagenesModule } from '../imagenes/imagenes.module.js';

@Module({
  imports: [PrismaModule, ImagenesModule],
  controllers: [VehiculosController],
  providers: [VehiculosService],
})
export class VehiculosModule {}