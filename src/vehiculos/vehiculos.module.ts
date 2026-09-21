import { Module } from '@nestjs/common';

import { VehiculosService } from '../vehiculos/vehiculos.service.js';
import { VehiculosController } from '../vehiculos/vehiculos.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [VehiculosController],
  providers: [VehiculosService],
})
export class VehiculosModule {}