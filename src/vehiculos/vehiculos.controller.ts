import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { VehiculosService } from '../vehiculos/vehiculos.service.js';
import { CreateVehicleDto } from '../vehiculos/dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from '../vehiculos/dto/update-vehicle.dto.js';

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
}