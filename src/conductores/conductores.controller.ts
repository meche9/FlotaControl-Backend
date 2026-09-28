import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  ParseIntPipe,
} from '@nestjs/common';

import { ConductoresService } from './conductores.service.js';
import { CreateConductorDto } from './dto/create-conductores.dto.js';
import { UpdateConductorDto } from './dto/update-conductores.dto.js';

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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.conductoresService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateConductorDto: UpdateConductorDto) {
    return this.conductoresService.update(id, updateConductorDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.conductoresService.remove(id);
  }
}