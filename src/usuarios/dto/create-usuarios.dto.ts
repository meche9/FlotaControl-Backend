import { 
  IsString, 
  IsOptional, 
  IsInt, 
  IsEmail, 
  IsEnum, 
  IsNotEmpty, 
  MaxLength, 
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UsuarioEstado } from '@prisma/client';
import { IsStrongPassword } from '../../common/validators/password-policy.js';

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

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(150)
  email: string;

  // Contraseña en claro: el servicio la guarda hasheada con bcrypt (nunca en texto plano)
  @IsNotEmpty()
  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsEnum(UsuarioEstado)
  estado?: UsuarioEstado;
}
