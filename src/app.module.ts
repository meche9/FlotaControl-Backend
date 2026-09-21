// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js'
import { VehiculosModule } from './vehiculos/vehiculos.module.js';

@Module({
  imports: [
    PrismaModule,
    VehiculosModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}