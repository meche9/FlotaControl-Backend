// Prefijo global de la API (usado también para acotar el path de la cookie de sesión)
export const API_PREFIX = 'api/v1';

// Claims estándar del JWT: se validan al verificar para rechazar tokens de otros emisores
export const JWT_ISSUER = 'flotacontrol-api';
export const JWT_AUDIENCE = 'flotacontrol-web';

// Cookie httpOnly que transporta el refresh token
export const REFRESH_COOKIE_NAME = 'ff_rt';
export const REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`;

export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
