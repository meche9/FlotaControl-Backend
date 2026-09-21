import { 
  IsString, 
  IsOptional, 
  IsInt, 
  IsEmail, 
  IsDateString, 
  IsEnum, 
  IsNotEmpty, 
  MaxLength, 
  Min 
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConductorSexo } from '@prisma/client';
import { ConductorEstadoCivil } from '@prisma/client';
import { ConductorEstado } from '@prisma/client';

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
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsEnum(ConductorSexo)
  sexo?: ConductorSexo;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nacionalidad?: string;

  @IsOptional()
  @IsEnum(ConductorEstadoCivil)
  estadoCivil?: ConductorEstadoCivil;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cargaFamiliar?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  tipoSangre?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  telefono: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoAuxiliar?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  urbBarrioParroquia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  avCalle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  edifCasa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  aptoPiso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  estadoCiudadMunicipio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  personaContacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoContacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  tallaCamisa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  tallaPantalon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  tallaChemise?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  tallaFranela?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  tallaCalzado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  banco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nroCuenta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  pagoMovil?: string;

  @IsOptional()
  @IsEnum(ConductorEstado)
  estado?: ConductorEstado;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  idVehiculoHabitual?: number;
}