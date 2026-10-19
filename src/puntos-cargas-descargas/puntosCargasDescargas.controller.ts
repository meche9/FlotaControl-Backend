import { Controller, Get, Post, Body, Patch, Param, Query, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { PuntosCargaService } from './puntosCargasDescargas.service.js';
import { CreatePuntoCargaDto } from './dto/create-cargasdescargas.js';
import { UpdatePuntoCargaDto } from './dto/update-cargasdescargas.js';

@Controller('puntos-carga')
export class PuntosCargaController {
    constructor(private readonly puntosCargaService: PuntosCargaService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createPuntoCargaDto: CreatePuntoCargaDto) {
        return this.puntosCargaService.create(createPuntoCargaDto);
    }

    @Get()
    findAll() {
        return this.puntosCargaService.findAll();
    }

    @Get('cliente/:idCliente')
    findByCliente(@Param('idCliente') idCliente: string) {
        return this.puntosCargaService.findByCliente(idCliente);
    }

    @Get('validar-codigo/:idCliente/:codigo')
    async validarCodigo(
        @Param('idCliente') idCliente: string,
        @Param('codigo') codigo: string,
        @Query('excludeId') excludeId?: string,
    ) {
        const existe = await this.puntosCargaService.checkCodigoExists(idCliente, codigo, excludeId);
        return { existe };
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.puntosCargaService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updatePuntoCargaDto: UpdatePuntoCargaDto) {
        return this.puntosCargaService.update(id, updatePuntoCargaDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
        return this.puntosCargaService.remove(id);
    }
}