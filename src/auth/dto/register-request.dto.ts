import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsStrongPassword } from '../../common/validators/password-policy.js';

export class RegisterRequestDto {
  @IsString({ message: 'El nombre completo o razón social debe ser texto' })
  @IsNotEmpty({ message: 'El nombre completo o razón social es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombreCompleto: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  @MaxLength(150, { message: 'El correo no puede exceder 150 caracteres' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  telefono?: string;
}
