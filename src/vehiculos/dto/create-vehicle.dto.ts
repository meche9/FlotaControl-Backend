import { IsString, IsInt, IsOptional, IsEnum, MaxLength, IsUUID } from 'class-validator';
import { VehicleStatus } from '@prisma/client';

export class CreateVehicleDto {
  @IsUUID('4', { message: 'El idClasificacion debe ser un UUID v4 válido' })
  idClasificacion: string;

  @IsString()
  @MaxLength(15)
  placa: string;

  @IsString()
  @MaxLength(50)
  marca: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  modelo?: string;

  @IsInt()
  anio: number;

  @IsString()
  @MaxLength(50)
  numeroChasis: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroMotor?: string;

  @IsOptional()
  capacidadCarga?: number;

  @IsOptional()
  capacidadArrastre?: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  estado?: VehicleStatus;

  // Cambiado de @IsInt() number a @IsUUID('4') string
  @IsOptional()
  @IsUUID('4', { message: 'El idAcopladoActual debe ser un UUID v4 válido' })
  idAcopladoActual?: string;
}
