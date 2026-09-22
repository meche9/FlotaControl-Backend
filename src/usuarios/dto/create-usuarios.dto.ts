import { 
  IsString, 
  IsOptional, 
  IsInt, 
  IsEmail, 
  IsEnum, 
  IsNotEmpty, 
  MaxLength, 
  MinLength 
} from 'class-validator';
import { Type } from 'class-transformer';
import { UsuarioEstado } from '@prisma/client';

export class CreateUsuarioDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  rolId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(150)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(255)
  passwordHash: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsEnum(UsuarioEstado)
  estado?: UsuarioEstado;
}

