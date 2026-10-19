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
import { RecargosService } from './recargos.service.js';
import { CreateRutaRecargoDto } from './dto/create-ruta-recargo.dto.js';
import { UpdateRutaRecargoDto } from './dto/update-ruta-recargo.dto.js';
import { SyncRutaRecargosDto } from './dto/sync-ruta-recargos.dto.js';

@Controller('rutas/recargos')
export class RecargosController {
  constructor(private readonly recargosService: RecargosService) {}

  @Get('catalogo')
  getCatalogoGenerales() {
    return this.recargosService.getCatalogoGenerales();
  }

  @Get('ruta/:idRuta')
  findByRuta(@Param('idRuta', new ParseUUIDPipe({ version: '4' })) idRuta: string) {
    return this.recargosService.findByRuta(idRuta);
  }

  @Post('asignar')
  @HttpCode(HttpStatus.OK)
  syncRecargosRuta(@Body() syncDto: SyncRutaRecargosDto) {
    return this.recargosService.syncRecargosRuta(syncDto.idRuta, syncDto.recargos);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDto: CreateRutaRecargoDto) {
    return this.recargosService.create(createDto);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.recargosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDto: UpdateRutaRecargoDto,
  ) {
    return this.recargosService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.recargosService.remove(id);
  }
}
