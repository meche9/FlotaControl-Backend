import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PeajesService } from './peajes.service.js';
import { CreateRutaPeajeDto } from './dto/create-ruta-peaje.dto.js';
import { UpdateRutaPeajeDto } from './dto/update-ruta-peaje.dto.js';
import { SyncRutaPeajesDto } from './dto/sync-ruta-peajes.dto.js';

@Controller('rutas/peajes')
export class PeajesController {
  constructor(private readonly peajesService: PeajesService) {}

  @Get('catalogo-vzla')
  getCatalogoVzla() {
    return this.peajesService.getCatalogoVzla();
  }

  @Get('ruta/:idRuta')
  findByRuta(@Param('idRuta', new ParseUUIDPipe({ version: '4' })) idRuta: string) {
    return this.peajesService.findByRuta(idRuta);
  }

  @Post('asignar')
  @HttpCode(HttpStatus.OK)
  syncPeajesRuta(@Body() syncDto: SyncRutaPeajesDto) {
    return this.peajesService.syncPeajesRuta(syncDto.idRuta, syncDto.peajes);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDto: CreateRutaPeajeDto) {
    return this.peajesService.create(createDto);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.peajesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDto: UpdateRutaPeajeDto,
  ) {
    return this.peajesService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.peajesService.remove(id);
  }
}
