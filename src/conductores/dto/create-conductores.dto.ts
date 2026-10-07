import {
  IsString,
  IsOptional,
  IsInt,
  IsEmail,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ConductorSexo } from '@prisma/client';
import { ConductorEstadoCivil } from '@prisma/client';
import { ConductorEstado } from '@prisma/client';

const emptyToUndefined = ({ value }: { value: any }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreateConductorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  cedulaIdentidad: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombres: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  apellidos: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  fechaIngreso?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(ConductorSexo)
  sexo?: ConductorSexo;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  nacionalidad?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(ConductorEstadoCivil)
  estadoCivil?: ConductorEstadoCivil;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cargaFamiliar?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(5)
  tipoSangre?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  telefono: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(20)
  telefonoAuxiliar?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  urbBarrioParroquia?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  avCalle?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  edifCasa?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  aptoPiso?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(150)
  estadoCiudadMunicipio?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  personaContacto?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(20)
  telefonoContacto?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(10)
  tallaCamisa?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(10)
  tallaPantalon?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(10)
  tallaChemise?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(10)
  tallaFranela?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(10)
  tallaCalzado?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  banco?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  nroCuenta?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  pagoMovil?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(ConductorEstado)
  estado?: ConductorEstado;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID('4', { message: 'El idVehiculoHabitual debe ser un UUID v4 válido' })
  idVehiculoHabitual?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(64)
  foto?: string;
}