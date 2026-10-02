import { IsString, IsInt, IsOptional, IsEnum, MaxLength, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleStatus } from '@prisma/client';

export class CreateVehicleDto {
  @Type(() => Number)
  @IsInt({ message: 'El idClasificacion debe ser un número entero' })
  idClasificacion: number;

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
