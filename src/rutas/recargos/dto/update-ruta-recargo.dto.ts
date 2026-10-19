import { PartialType } from '@nestjs/mapped-types';
import { CreateRutaRecargoDto } from './create-ruta-recargo.dto.js';

export class UpdateRutaRecargoDto extends PartialType(CreateRutaRecargoDto) {}
