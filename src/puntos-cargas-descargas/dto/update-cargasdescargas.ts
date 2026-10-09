import { PartialType } from '@nestjs/mapped-types';
import { CreatePuntoCargaDto } from './create-cargasdescargas.js';

export class UpdatePuntoCargaDto extends PartialType(CreatePuntoCargaDto) { }