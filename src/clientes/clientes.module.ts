import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service.js';
import { ClientesController } from './clientes.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js'; // Asegúrate de importar tu módulo de Prisma si aplica

@Module({
    imports: [PrismaModule],
    controllers: [ClientesController],
    providers: [ClientesService],
    exports: [ClientesService],
})
export class ClientesModule { }