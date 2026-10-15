import { PartialType } from '@nestjs/mapped-types';
import { CreateRutaDto } from './create-ruta.dto.js';

export class UpdateRutaDto extends PartialType(CreateRutaDto) {}
