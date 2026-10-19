import { Module } from '@nestjs/common';
import { RecargosService } from './recargos.service.js';
import { RecargosController } from './recargos.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [RecargosController],
  providers: [RecargosService],
  exports: [RecargosService],
})
export class RecargosModule {}
