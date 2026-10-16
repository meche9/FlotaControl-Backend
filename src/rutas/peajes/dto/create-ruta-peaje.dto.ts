import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRutaPeajeDto {
  @IsUUID('4', { message: 'idRuta debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'idRuta es obligatorio' })
  idRuta: string;

  @IsString({ message: 'El nombre del peaje debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del peaje es obligatorio' })
  @MaxLength(150, { message: 'El nombre del peaje no puede exceder 150 caracteres' })
  nombrePeaje: string;

  @IsOptional()
  @IsString({ message: 'La ubicación debe ser texto' })
  @MaxLength(255, { message: 'La ubicación no puede exceder 255 caracteres' })
  ubicacion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(1, { message: 'El orden mínimo es 1' })
  orden?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El costo debe ser un número válido' })
  @Min(0, { message: 'El costo no puede ser negativo' })
  costo?: number = 0.0;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser booleano' })
  activo?: boolean = true;
}
