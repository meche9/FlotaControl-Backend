import { PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from './create-usuarios.dto.js';

export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {}