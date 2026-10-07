import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { ConductorSexo, ConductorEstadoCivil, ConductorEstado } from '@prisma/client';
import { CreateConductorDto } from './create-conductores.dto.js';

const emptyToUndefined = ({ value }: { value: any }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const emptyToNull = ({ value }: { value: any }) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

export class UpdateConductorDto extends PartialType(CreateConductorDto) {
  @Transform(emptyToUndefined)
  fechaNacimiento?: string;

  @Transform(emptyToUndefined)
  fechaIngreso?: string;

  @Transform(emptyToNull)
  email?: string;

  @Transform(emptyToNull)
  idVehiculoHabitual?: string;

  @Transform(emptyToNull)
  tipoSangre?: string;

  @Transform(emptyToUndefined)
  sexo?: ConductorSexo;

  @Transform(emptyToUndefined)
  nacionalidad?: string;

  @Transform(emptyToUndefined)
  estadoCivil?: ConductorEstadoCivil;

  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  cargaFamiliar?: number;

  @Transform(emptyToNull)
  telefonoAuxiliar?: string;

  @Transform(emptyToNull)
  direccion?: string;

  @Transform(emptyToNull)
  urbBarrioParroquia?: string;

  @Transform(emptyToNull)
  avCalle?: string;

  @Transform(emptyToNull)
  edifCasa?: string;

  @Transform(emptyToNull)
  aptoPiso?: string;

  @Transform(emptyToUndefined)
  estadoCiudadMunicipio?: string;

  @Transform(emptyToNull)
  personaContacto?: string;

  @Transform(emptyToNull)
  telefonoContacto?: string;

  @Transform(emptyToNull)
  tallaCamisa?: string;

  @Transform(emptyToNull)
  tallaPantalon?: string;

  @Transform(emptyToNull)
  tallaChemise?: string;

  @Transform(emptyToNull)
  tallaFranela?: string;

  @Transform(emptyToNull)
  tallaCalzado?: string;

  @Transform(emptyToNull)
  banco?: string;

  @Transform(emptyToNull)
  nroCuenta?: string;

  @Transform(emptyToNull)
  pagoMovil?: string;

  @Transform(emptyToUndefined)
  estado?: ConductorEstado;

  @Transform(emptyToNull)
  foto?: string;
}