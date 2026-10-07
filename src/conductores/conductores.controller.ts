import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Body, 
  Patch, 
  Param, 
  Delete,
  Header,
  ParseUUIDPipe,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'node:fs';

import { ConductoresService } from './conductores.service.js';
import { CreateConductorDto } from './dto/create-conductores.dto.js';
import { UpdateConductorDto } from './dto/update-conductores.dto.js';
import { OPCIONES_SUBIDA_IMAGEN, type ArchivoImagen } from '../imagenes/imagenes.service.js';

@Controller('conductores')
export class ConductoresController {
  constructor(private readonly conductoresService: ConductoresService) {}

  @Post()
  create(@Body() createConductorDto: CreateConductorDto) {
    return this.conductoresService.create(createConductorDto);
  }

  @Get()
  findAll() {
    return this.conductoresService.findAll();
  }

  @Get('cedula/:cedula')
  findByCedula(@Param('cedula') cedula: string) {
    return this.conductoresService.findByCedula(cedula);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.conductoresService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() updateConductorDto: UpdateConductorDto) {
    return this.conductoresService.update(id, updateConductorDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.conductoresService.remove(id);
  }

  @Put(':id/foto')
  @UseInterceptors(FileInterceptor('foto', OPCIONES_SUBIDA_IMAGEN))
  subirFoto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() archivo: ArchivoImagen | undefined,
  ) {
    return this.conductoresService.actualizarFoto(id, archivo);
  }

  @Get(':id/foto')
  @Header('Cache-Control', 'private, max-age=86400')
  async obtenerFoto(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const imagen = await this.conductoresService.obtenerFoto(id);
    return new StreamableFile(createReadStream(imagen.ruta), { type: imagen.tipo });
  }

  @Delete(':id/foto')
  eliminarFoto(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.conductoresService.eliminarFoto(id);
  }
}