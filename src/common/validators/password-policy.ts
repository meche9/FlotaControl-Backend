import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Política de contraseñas (OWASP A07 / ASVS 2.1).
// El máximo es 64 porque bcrypt ignora todo lo que exceda 72 bytes.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export function IsStrongPassword() {
  return applyDecorators(
    IsString({ message: 'La contraseña debe ser texto' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `La contraseña no puede exceder ${PASSWORD_MAX_LENGTH} caracteres`,
    }),
    Matches(PASSWORD_COMPLEXITY_REGEX, {
      message: 'La contraseña debe incluir mayúscula, minúscula, número y un carácter especial',
    }),
  );
}
