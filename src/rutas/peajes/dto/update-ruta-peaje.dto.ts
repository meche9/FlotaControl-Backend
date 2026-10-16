import { PartialType } from '@nestjs/mapped-types';
import { CreateRutaPeajeDto } from './create-ruta-peaje.dto.js';

export class UpdateRutaPeajeDto extends PartialType(CreateRutaPeajeDto) {}
