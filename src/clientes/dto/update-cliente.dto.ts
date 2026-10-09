import { PartialType } from '@nestjs/mapped-types';
import { CreateClienteDto } from './create-cliente.dto.js';

export class UpdateClienteDto extends PartialType(CreateClienteDto) { }