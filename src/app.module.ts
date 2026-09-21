// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js'
import { VehiculosModule } from './vehiculos/vehiculos.module.js';
import { ConductoresModule } from './conductores/conductores.module.js';

@Module({
  imports: [
    PrismaModule,
    VehiculosModule,
    ConductoresModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}