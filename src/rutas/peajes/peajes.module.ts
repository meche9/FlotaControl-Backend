import { Module } from '@nestjs/common';
import { PeajesService } from './peajes.service.js';
import { PeajesController } from './peajes.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PeajesController],
  providers: [PeajesService],
  exports: [PeajesService],
})
export class PeajesModule {}
