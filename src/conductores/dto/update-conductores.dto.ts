import { PartialType } from '@nestjs/mapped-types';
import { CreateConductorDto } from './create-conductores.dto.js';

export class UpdateConductorDto extends PartialType(CreateConductorDto) {}