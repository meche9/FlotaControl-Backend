import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  MaxLength,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RecargoTipoCalculo } from '@prisma/client';
import { normalizeRecargoTipoCalculo } from './create-ruta-recargo.dto.js';

export class ItemRutaRecargoDto {
  @IsString({ message: 'El concepto del recargo es obligatorio' })
  @IsNotEmpty()
  @MaxLength(100)
  concepto: string;

  @IsOptional()
  @Transform(normalizeRecargoTipoCalculo)
  @IsEnum(RecargoTipoCalculo, {
    message: 'El tipo de cálculo debe ser válido (Monto Fijo, Porcentaje, Por Hora)',
  })
  tipoCalculo?: RecargoTipoCalculo = RecargoTipoCalculo.Monto_Fijo;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El valor debe ser numérico' })
  @Min(0)
  valor?: number = 0;
}

export class SyncRutaRecargosDto {
  @IsUUID('4', { message: 'idRuta debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'idRuta es obligatorio' })
  idRuta: string;

  @IsArray({ message: 'recargos debe ser un arreglo de recargos' })
  @ValidateNested({ each: true })
  @Type(() => ItemRutaRecargoDto)
  recargos: ItemRutaRecargoDto[];
}
