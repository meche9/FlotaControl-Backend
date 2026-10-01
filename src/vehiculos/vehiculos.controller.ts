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
import { VehiculosService } from '../vehiculos/vehiculos.service.js';
import { CreateVehicleDto } from '../vehiculos/dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from '../vehiculos/dto/update-vehicle.dto.js';
import { OPCIONES_SUBIDA_IMAGEN, type ArchivoImagen } from '../imagenes/imagenes.service.js';

@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) { }

  @Post()
  create(@Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiculosService.create(createVehicleDto);
  }

  @Get()
  findAll() {
    return this.vehiculosService.findAll();
  }


  @Get('placa/:placa')
  findOneByPlaca(@Param('placa') placa: string) {
    return this.vehiculosService.findOneByPlaca(placa);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.vehiculosService.findOne(id);
  }



  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ) {
    return this.vehiculosService.update(id, updateVehicleDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.vehiculosService.remove(id);
  }

  @Put(':id/foto')
  @UseInterceptors(FileInterceptor('foto', OPCIONES_SUBIDA_IMAGEN))
  subirFoto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() archivo: ArchivoImagen | undefined,
  ) {
    return this.vehiculosService.actualizarFoto(id, archivo);
  }

  @Get(':id/foto')
  @Header('Cache-Control', 'private, max-age=86400')
  async obtenerFoto(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const imagen = await this.vehiculosService.obtenerFoto(id);
    return new StreamableFile(createReadStream(imagen.ruta), { type: imagen.tipo });
  }

  @Delete(':id/foto')
  eliminarFoto(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.vehiculosService.eliminarFoto(id);
  }
}
