import { Module } from '@nestjs/common';
import { ImagenesService } from './imagenes.service.js';

@Module({
  providers: [ImagenesService],
  exports: [ImagenesService],
})
export class ImagenesModule {}
