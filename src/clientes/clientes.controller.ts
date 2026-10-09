import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ClientesService } from './clientes.service.js';
import { CreateClienteDto } from './dto/create-cliente.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';

@Controller('clientes')
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createClienteDto: CreateClienteDto) {
        return this.clientesService.create(createClienteDto);
    }

    @Get()
    findAll() {
        return this.clientesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.clientesService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateClienteDto: UpdateClienteDto) {
        return this.clientesService.update(id, updateClienteDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
        return this.clientesService.remove(id);
    }
}