// nominasProcesos.controller.ts
import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { NominasProcesosService } from './nominasProcesos.service.js';
import { CreateProcesoNominaDto } from './dto/create-proceso-nomina.dto.js';
import { UpdateProcesoNominaDto } from './dto/update-proceso-nomina.dto.js';

@Controller('nominas-procesos')
export class NominasProcesosController {
    constructor(
        private readonly nominasProcesosService: NominasProcesosService,
    ) { }

    @Post('abrir')
    async abrir(@Body() dto: CreateProcesoNominaDto) {
        return await this.nominasProcesosService.abrirProceso(dto);
    }

    @Get('tipos')
    async listarTipos() {
        return await this.nominasProcesosService.listarTiposNomina();
    }

    @Get()
    async findAll(
        @Query('idCodnomina') idCodnomina?: string,
        @Query('soloAbiertos') soloAbiertos?: string,
    ) {
        return await this.nominasProcesosService.findAll({
            idCodnomina,
            soloAbiertos: soloAbiertos === 'true',
        });
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return await this.nominasProcesosService.findOne(id);
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateProcesoNominaDto,
    ) {
        return await this.nominasProcesosService.update(id, dto);
    }
}