import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RecargoTipoCalculo } from '@prisma/client';

export const normalizeRecargoTipoCalculo = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'Monto Fijo' || trimmed === 'Monto_Fijo') return RecargoTipoCalculo.Monto_Fijo;
    if (trimmed === 'Porcentaje') return RecargoTipoCalculo.Porcentaje;
    if (trimmed === 'Por Hora' || trimmed === 'Por_Hora') return RecargoTipoCalculo.Por_Hora;
  }
  return value;
};

export class CreateRutaRecargoDto {
  @IsUUID('4', { message: 'idRuta debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'idRuta es obligatorio' })
  idRuta: string;

  @IsString({ message: 'El concepto del recargo debe ser texto' })
  @IsNotEmpty({ message: 'El concepto del recargo es obligatorio' })
  @MaxLength(100, { message: 'El concepto del recargo no puede exceder 100 caracteres' })
  concepto: string;

  @IsOptional()
  @Transform(normalizeRecargoTipoCalculo)
  @IsEnum(RecargoTipoCalculo, {
    message: 'El tipo de cálculo debe ser válido (Monto Fijo, Porcentaje, Por Hora)',
  })
  tipoCalculo?: RecargoTipoCalculo = RecargoTipoCalculo.Monto_Fijo;

  @Type(() => Number)
  @IsNumber({}, { message: 'El valor debe ser un número válido' })
  @Min(0, { message: 'El valor no puede ser negativo' })
  valor: number;
}
