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
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemRutaPeajeDto {
  @IsString({ message: 'El nombre del peaje es obligatorio' })
  @IsNotEmpty()
  @MaxLength(150)
  nombrePeaje: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ubicacion?: string;

  @Type(() => Number)
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(1)
  orden: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'El costo debe ser un valor numérico' })
  @Min(0)
  costo: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean = true;
}

export class SyncRutaPeajesDto {
  @IsUUID('4', { message: 'idRuta debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'idRuta es obligatorio' })
  idRuta: string;

  @IsArray({ message: 'peajes debe ser un arreglo de peajes' })
  @ValidateNested({ each: true })
  @Type(() => ItemRutaPeajeDto)
  peajes: ItemRutaPeajeDto[];
}
