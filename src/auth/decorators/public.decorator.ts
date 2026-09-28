import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorador para marcar rutas como públicas (sin autenticación JWT).
 * Úsese en controllers o métodos individuales.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
