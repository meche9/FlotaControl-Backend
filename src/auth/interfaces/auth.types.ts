import type { Request } from 'express';

// Payload firmado en el access token (JWT HS256)
export interface AccessTokenPayload {
  sub: number;
  rolId: number;
  // Versión de credenciales: si no coincide con la BD el token queda invalidado
  ver: number;
  typ: 'access';
}

// Usuario adjuntado al request por JwtAuthGuard (leído de la BD en cada petición)
export interface AuthenticatedUser {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  rolId: number;
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
