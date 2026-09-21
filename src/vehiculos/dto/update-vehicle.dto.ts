import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleDto } from './create-vehicle.dto.js';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}