import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
  ValidateIf,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RutaTipoCobro } from '@prisma/client';

const normalizeTipoCobro = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'Por Viaje Fijo' || trimmed === 'Por_Viaje_Fijo') return RutaTipoCobro.Por_Viaje_Fijo;
    if (trimmed === 'Por Tonelada' || trimmed === 'Por_Tonelada') return RutaTipoCobro.Por_Tonelada;
    if (trimmed === 'Por Kilometro' || trimmed === 'Por_Kilometro') return RutaTipoCobro.Por_Kilometro;
    if (trimmed === 'Por Volumen M3' || trimmed === 'Por_Volumen_M3') return RutaTipoCobro.Por_Volumen_M3;
  }
  return value;
};

export class CreateRutaDto {
  @IsUUID('4', { message: 'El idCliente debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  idCliente: string;

  @IsString({ message: 'El nombre de la ruta debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la ruta es obligatorio' })
  @MaxLength(150, { message: 'El nombre de la ruta no puede exceder los 150 caracteres' })
  nombreRuta: string;

  @IsString({ message: 'La ciudad de origen debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La ciudad de origen es obligatoria' })
  @MaxLength(100, { message: 'La ciudad de origen no puede exceder los 100 caracteres' })
  ciudadOrigen: string;

  @IsString({ message: 'La ciudad de destino debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La ciudad de destino es obligatoria' })
  @MaxLength(100, { message: 'La ciudad de destino no puede exceder los 100 caracteres' })
  ciudadDestino: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsUUID('4', { message: 'El id del punto de origen debe ser un UUID v4 válido' })
  idPuntoOrigen?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsUUID('4', { message: 'El id del punto de destino debe ser un UUID v4 válido' })
  idPuntoDestino?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La distancia en kilómetros debe ser un número válido' })
  @Min(0, { message: 'La distancia en kilómetros no puede ser un valor negativo' })
  distanciaKm?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @Type(() => Number)
  @IsNumber({}, { message: 'El tiempo estimado en horas debe ser un número válido' })
  @Min(0, { message: 'El tiempo estimado en horas no puede ser un valor negativo' })
  tiempoEstimadoHoras?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El consumo estimado de gasoil debe ser un número válido' })
  @Min(0, { message: 'El consumo estimado de gasoil no puede ser un valor negativo' })
  consumoEstimadoGasoil?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto de la tarifa debe ser un número válido' })
  @Min(0, { message: 'El monto de la tarifa no puede ser un valor negativo' })
  montoTarifa?: number;

  @IsOptional()
  @Transform(normalizeTipoCobro)
  @IsEnum(RutaTipoCobro, {
    message: 'El tipo de cobro debe ser válido (Por Viaje Fijo, Por Tonelada, Por Kilometro, Por Volumen M3)',
  })
  tipoCobro?: RutaTipoCobro;

  @IsOptional()
  @IsString({ message: 'La moneda debe ser una cadena de texto' })
  @MaxLength(10, { message: 'La moneda no puede exceder los 10 caracteres' })
  moneda?: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser un valor booleano' })
  activo?: boolean;
}
