import type { Request } from 'express';

// Payload firmado en el access token (JWT HS256)
export interface AccessTokenPayload {
  sub: string;
  rolId: string;
  // Versión de credenciales: si no coincide con la BD el token queda invalidado
  ver: number;
  typ: 'access';
}

// Usuario adjuntado al request por JwtAuthGuard (leído de la BD en cada petición)
export interface AuthenticatedUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rolId: string;
  rol: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Metadatos del cliente para auditar sesiones
export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}
