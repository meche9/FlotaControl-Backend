import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { VehiculosService } from '../vehiculos/vehiculos.service.js';
import { CreateVehicleDto } from '../vehiculos/dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from '../vehiculos/dto/update-vehicle.dto.js';

@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  create(@Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiculosService.create(createVehicleDto);
  }

  @Get()
  findAll() {
    return this.vehiculosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateVehicleDto: UpdateVehicleDto) {
    return this.vehiculosService.update(id, updateVehicleDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculosService.remove(id);
  }
}