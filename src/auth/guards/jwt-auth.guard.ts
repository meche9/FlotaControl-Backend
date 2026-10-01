import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AccessTokenPayload, AuthenticatedRequest } from '../interfaces/auth.types.js';

const SESION_INVALIDA = 'Token de acceso inválido o expirado';

/**
 * Guard global: toda ruta requiere un access token válido salvo las marcadas con @Public().
 * Además del JWT, verifica en la BD que el usuario siga activo y que sus credenciales
 * no hayan cambiado (tokenVersion), para poder invalidar sesiones al instante.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token de acceso no proporcionado');
    }

    let payload: AccessTokenPayload;
    try {
      // Algoritmo, issuer y audience se validan con las verifyOptions del JwtModule
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        estado: true,
        rolId: true,
        tokenVersion: true,
        rol: { select: { nombre: true } },
      },
    });

    if (!usuario || usuario.estado !== 'activo' || usuario.tokenVersion !== payload.ver) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    request.user = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rolId: usuario.rolId,
      rol: usuario.rol.nombre,
    };

    return true;
  }

  private extractTokenFromHeader(request: AuthenticatedRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
