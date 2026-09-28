import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password-policy.js';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'El token de restablecimiento es requerido' })
  @Matches(/^[a-f0-9]{64}$/, { message: 'El enlace de restablecimiento es inválido o ha expirado' })
  token: string;

  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @IsStrongPassword()
  newPassword: string;
}
