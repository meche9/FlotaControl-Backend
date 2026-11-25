// nominasCalculo.controller.ts
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { NominaCalculoEstado } from '@prisma/client';
import { NominasCalculoService } from './nominasCalculo.service.js';
import { CreateNominaCalculoDto } from './dto/create-nomina-calculo.dto.js';
import { UpdateNominaCalculoDto } from './dto/update-nomina-calculo.dto.js';

@Controller('nominas-calculo')
export class NominasCalculoController {
    constructor(
        private readonly nominasCalculoService: NominasCalculoService,
    ) { }

    @Post()
    async create(@Body() dto: CreateNominaCalculoDto) {
        return await this.nominasCalculoService.create(dto);
    }

    @Get()
    async findAll(
        @Query('idProcesonomina') idProcesonomina?: string,
        @Query('idConductor') idConductor?: string,
        @Query('estado') estado?: NominaCalculoEstado,
    ) {
        return await this.nominasCalculoService.findAll({
            idProcesonomina,
            idConductor,
            estado,
        });
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return await this.nominasCalculoService.findOne(id);
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateNominaCalculoDto,
    ) {
        return await this.nominasCalculoService.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return await this.nominasCalculoService.remove(id);
    }
}