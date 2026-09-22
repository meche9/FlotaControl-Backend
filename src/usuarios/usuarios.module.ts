import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}