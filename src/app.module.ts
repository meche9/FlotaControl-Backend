// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js'
import { VehiculosModule } from './vehiculos/vehiculos.module.js';
import { ConductoresModule } from './conductores/conductores.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    PrismaModule,
    UsuariosModule,
    VehiculosModule,
    ConductoresModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}