import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Nombres de rol (tabla roles) con permisos de administración de usuarios
export const ROLES_ADMINISTRACION = ['Administrador', 'Super Admin'];

/**
 * Restringe una ruta a los roles indicados (OWASP A01: control de acceso).
 * La comparación con el nombre del rol no distingue mayúsculas/minúsculas.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
