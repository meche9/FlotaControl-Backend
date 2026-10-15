import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RutasService } from './rutas.service.js';
import { CreateRutaDto } from './dto/create-ruta.dto.js';
import { UpdateRutaDto } from './dto/update-ruta.dto.js';

@Controller('rutas')
export class RutasController {
  constructor(private readonly rutasService: RutasService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRutaDto: CreateRutaDto) {
    return this.rutasService.create(createRutaDto);
  }

  @Get()
  findAll(
    @Query('idCliente') idCliente?: string,
    @Query('activo') activo?: string,
  ) {
    const activoParsed =
      activo !== undefined ? activo === 'true' || activo === '1' : undefined;
    return this.rutasService.findAll({ idCliente, activo: activoParsed });
  }

  @Get('cliente/:idCliente')
  findByCliente(
    @Param('idCliente', new ParseUUIDPipe({ version: '4' })) idCliente: string,
  ) {
    return this.rutasService.findByCliente(idCliente);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.rutasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateRutaDto: UpdateRutaDto,
  ) {
    return this.rutasService.update(id, updateRutaDto);
  }

  @Patch(':id/toggle-estado')
  toggleEstado(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.rutasService.toggleEstado(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.rutasService.remove(id);
  }
}
