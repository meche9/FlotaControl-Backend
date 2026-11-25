// nominasCalculo.module.ts
import { Module } from '@nestjs/common';
import { NominasCalculoController } from './nominasCalculo.controller.js';
import { NominasCalculoService } from './nominasCalculo.service.js';

@Module({
    controllers: [NominasCalculoController],
    providers: [NominasCalculoService],
    exports: [NominasCalculoService],
})
export class NominasCalculoModule { }