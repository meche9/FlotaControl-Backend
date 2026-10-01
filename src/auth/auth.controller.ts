import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { createReadStream } from 'node:fs';
import { AuthService, type SesionEmitida } from './auth.service.js';
import { PerfilService } from './perfil.service.js';
import { OPCIONES_SUBIDA_IMAGEN, type ArchivoImagen } from '../imagenes/imagenes.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser, ClientInfo } from './interfaces/auth.types.js';
import {
  parseOrigins,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from '../config/constants.js';

@Controller('auth')
export class AuthController {
  private readonly allowedOrigins: Set<string>;
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    private readonly perfilService: PerfilService,
    config: ConfigService,
  ) {
    this.allowedOrigins = new Set(parseOrigins(config.get<string>('CORS_ORIGINS')));
    this.cookieOptions = {
      httpOnly: true, // inaccesible desde JavaScript (mitiga robo por XSS)
      secure: config.get<boolean>('COOKIE_SECURE'),
      sameSite: config.get<'strict' | 'lax' | 'none'>('COOKIE_SAMESITE'),
      path: REFRESH_COOKIE_PATH, // solo viaja a los endpoints de /auth
    };
  }

  /**
   * POST /auth/login — Ruta pública.
   * Devuelve el access token en el body y el refresh token en una cookie httpOnly.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sesion = await this.authService.login(loginDto, this.clientInfo(req));
    return this.responderSesion(res, sesion);
  }

  /**
   * POST /auth/refresh — Ruta pública (autenticada por la cookie de refresh).
   * Rota el refresh token y emite un nuevo access token.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedOrigin(req);
    try {
      const sesion = await this.authService.refresh(this.refreshCookie(req), this.clientInfo(req));
      return this.responderSesion(res, sesion);
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions);
      throw err;
    }
  }

  /**
   * POST /auth/logout — Ruta pública para poder cerrar sesión aun con el access token vencido.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedOrigin(req);
    await this.authService.logout(this.refreshCookie(req));
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions);
  }

  /**
   * POST /auth/forgot-password — Ruta pública.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  /**
   * POST /auth/reset-password — Ruta pública.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  /**
   * GET /auth/profile — Ruta protegida.
   */
  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  @Put('profile/foto')
  @UseInterceptors(FileInterceptor('foto', OPCIONES_SUBIDA_IMAGEN))
  subirFotoPerfil(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() archivo: ArchivoImagen | undefined,
  ) {
    return this.perfilService.actualizarFoto(user.id, archivo);
  }

  @Get('profile/foto')
  @Header('Cache-Control', 'private, max-age=86400')
  async obtenerFotoPerfil(@CurrentUser() user: AuthenticatedUser) {
    const imagen = await this.perfilService.obtenerFoto(user.id);
    return new StreamableFile(createReadStream(imagen.ruta), { type: imagen.tipo });
  }

  @Delete('profile/foto')
  eliminarFotoPerfil(@CurrentUser() user: AuthenticatedUser) {
    return this.perfilService.eliminarFoto(user.id);
  }

  private responderSesion(res: Response, sesion: SesionEmitida) {
    res.cookie(REFRESH_COOKIE_NAME, sesion.refreshToken, {
      ...this.cookieOptions,
      // Sin "recordar" es cookie de sesión: se borra al cerrar el navegador
      ...(sesion.recordar ? { expires: sesion.refreshExpiraEn } : {}),
    });
    res.setHeader('Cache-Control', 'no-store');

    return {
      accessToken: sesion.accessToken,
      expiresIn: sesion.expiresIn,
      user: sesion.user,
    };
  }

  // Defensa CSRF para los endpoints autenticados por cookie (OWASP A01)
  private assertTrustedOrigin(req: Request): void {
    const origin = req.headers.origin;
    if (origin && !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Origen no permitido');
    }
  }

  private refreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private clientInfo(req: Request): ClientInfo {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }
}
