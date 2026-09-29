// Validación de variables de entorno al arrancar (OWASP A05: configuración segura).
// Si falta algo crítico la aplicación NO inicia, en vez de arrancar con valores inseguros.

type Env = Record<string, unknown>;

const MIN_JWT_SECRET_LENGTH = 32;

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return undefined;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

function asPositiveInt(name: string, value: unknown, fallback: number): number {
  const str = asString(value);
  if (str === undefined) return fallback;
  const num = Number(str);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`La variable ${name} debe ser un entero positivo (recibido: "${str}")`);
  }
  return num;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  const str = asString(value)?.toLowerCase();
  if (str === undefined) return fallback;
  return ['true', '1', 'yes', 'si'].includes(str);
}

export function validateEnv(config: Env): Env {
  const errores: string[] = [];
  const nodeEnv = asString(config.NODE_ENV) ?? 'development';
  const isProduction = nodeEnv === 'production';

  if (!asString(config.DATABASE_URL)) {
    errores.push('DATABASE_URL es requerida');
  }

  const jwtSecret = asString(config.JWT_SECRET);
  if (!jwtSecret) {
    errores.push('JWT_SECRET es requerida');
  } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errores.push(
      `JWT_SECRET debe tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres aleatorios ` +
        `(genere uno con: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")`,
    );
  }

  const cookieSameSite = (asString(config.COOKIE_SAMESITE) ?? 'strict').toLowerCase();
  if (!['strict', 'lax', 'none'].includes(cookieSameSite)) {
    errores.push('COOKIE_SAMESITE debe ser strict, lax o none');
  }

  const cookieSecure = asBoolean(config.COOKIE_SECURE, isProduction);
  if (cookieSameSite === 'none' && !cookieSecure) {
    errores.push('COOKIE_SAMESITE=none requiere COOKIE_SECURE=true');
  }

  if (isProduction && !asString(config.SMTP_HOST)) {
    errores.push('SMTP_HOST es requerida en producción para enviar correos de restablecimiento');
  }

  let validado: Env = {};
  try {
    validado = {
      ...config,
      NODE_ENV: nodeEnv,
      PORT: asPositiveInt('PORT', config.PORT, 3000),
      JWT_SECRET: jwtSecret,
      JWT_ACCESS_TTL_MINUTES: asPositiveInt('JWT_ACCESS_TTL_MINUTES', config.JWT_ACCESS_TTL_MINUTES, 15),
      REFRESH_SESSION_TTL_HOURS: asPositiveInt('REFRESH_SESSION_TTL_HOURS', config.REFRESH_SESSION_TTL_HOURS, 12),
      REFRESH_REMEMBER_TTL_DAYS: asPositiveInt('REFRESH_REMEMBER_TTL_DAYS', config.REFRESH_REMEMBER_TTL_DAYS, 7),
      RESET_TOKEN_TTL_MINUTES: asPositiveInt('RESET_TOKEN_TTL_MINUTES', config.RESET_TOKEN_TTL_MINUTES, 30),
      BCRYPT_ROUNDS: asPositiveInt('BCRYPT_ROUNDS', config.BCRYPT_ROUNDS, 12),
      COOKIE_SECURE: cookieSecure,
      COOKIE_SAMESITE: cookieSameSite,
      CORS_ORIGINS: asString(config.CORS_ORIGINS) ?? 'http://localhost:5173,http://localhost:4173',
      FRONTEND_URL: asString(config.FRONTEND_URL) ?? 'http://localhost:5173',
      SMTP_PORT: asPositiveInt('SMTP_PORT', config.SMTP_PORT, 587),
      SMTP_SECURE: asBoolean(config.SMTP_SECURE, false),
    };
  } catch (err) {
    errores.push((err as Error).message);
  }

  if (errores.length > 0) {
    throw new Error(`Configuración inválida:\n  - ${errores.join('\n  - ')}`);
  }

  return validado;
}
