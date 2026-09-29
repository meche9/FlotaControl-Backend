import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { AccessTokenPayload, ClientInfo } from './interfaces/auth.types.js';

type UsuarioConRol = Prisma.UsuarioGetPayload<{ include: { rol: true } }>;

export interface UsuarioPublico {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  estado: string;
  ultimoAcceso: Date | null;
  rol: { id: number; nombre: string; descripcion: string | null };
}

export interface SesionEmitida {
  accessToken: string;
  expiresIn: number;
  // El refresh token solo lo usa el controller para la cookie httpOnly; nunca va en el body
  refreshToken: string;
  refreshExpiraEn: Date;
  recordar: boolean;
  user: UsuarioPublico;
}

interface IntentosFallidos {
  count: number;
  lastFailureAt: number;
  lockedUntil: number | null;
}

// Mensajes genéricos: no revelan si el email existe (OWASP A07)
const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
const SESION_INVALIDA = 'Sesión inválida o expirada. Inicie sesión nuevamente.';
const ENLACE_INVALIDO = 'El enlace de restablecimiento es inválido o ha expirado';
const MENSAJE_SOLICITUD_RESET =
  'Si el email está registrado, recibirá instrucciones para restablecer su contraseña.';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Protección contra fuerza bruta por cuenta (complementa el rate limit por IP)
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000;
  private readonly MAX_TRACKED_EMAILS = 10_000;
  // Evita reenviar correos de restablecimiento en ráfaga a la misma cuenta
  private readonly RESET_COOLDOWN_MS = 2 * 60 * 1000;

  // En memoria: suficiente para una instancia. Con varias instancias usar Redis.
  private readonly failedAttempts = new Map<string, IntentosFallidos>();

  private readonly bcryptRounds: number;
  private readonly accessTtlSeconds: number;
  private readonly sessionTtlMs: number;
  private readonly rememberTtlMs: number;
  private readonly resetTtlMinutes: number;
  private readonly frontendUrl: string;
  // Hash señuelo para igualar el tiempo de respuesta cuando el email no existe
  private readonly dummyHash: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    config: ConfigService,
  ) {
    this.bcryptRounds = config.get<number>('BCRYPT_ROUNDS') ?? 12;
    this.accessTtlSeconds = (config.get<number>('JWT_ACCESS_TTL_MINUTES') ?? 15) * 60;
    this.sessionTtlMs = (config.get<number>('REFRESH_SESSION_TTL_HOURS') ?? 12) * 60 * 60 * 1000;
    this.rememberTtlMs = (config.get<number>('REFRESH_REMEMBER_TTL_DAYS') ?? 7) * 24 * 60 * 60 * 1000;
    this.resetTtlMinutes = config.get<number>('RESET_TOKEN_TTL_MINUTES') ?? 30;
    this.frontendUrl = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
    this.dummyHash = bcrypt.hashSync(randomBytes(16).toString('hex'), this.bcryptRounds);
  }

  /**
   * Autenticación con email y contraseña.
   * La contraseña se verifica SIEMPRE (aunque el email no exista) para no filtrar
   * información por tiempo de respuesta, y el estado de la cuenta solo se revela
   * a quien ya demostró conocer la contraseña.
   */
  async login(loginDto: LoginDto, client: ClientInfo = {}): Promise<SesionEmitida> {
    const email = loginDto.email.trim().toLowerCase();
    this.assertNotLocked(email);

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { rol: true },
    });

    const passwordValida = await this.compararPassword(
      loginDto.password,
      usuario?.passwordHash ?? this.dummyHash,
    );

    if (!usuario || !passwordValida) {
      this.registerFailure(email);
      this.logger.warn(`Login fallido para ${email} desde ${client.ip ?? 'IP desconocida'}`);
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    if (usuario.estado !== 'activo') {
      this.logger.warn(`Login rechazado: cuenta ${usuario.estado} (usuario ID ${usuario.id})`);
      throw new UnauthorizedException(
        'Su cuenta se encuentra inactiva o suspendida. Contacte al administrador.',
      );
    }

    this.clearFailures(email);

    const actualizado = await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
      include: { rol: true },
    });

    this.logger.log(`Login exitoso: usuario ID ${usuario.id}`);

    return this.emitirSesion(actualizado, {
      familia: randomUUID(),
      recordar: loginDto.recordar ?? false,
      client,
    });
  }

  /**
   * Rota el refresh token: el token presentado se revoca y se emite uno nuevo de la
   * misma familia. Si se presenta un token ya revocado (posible robo), se revoca
   * toda la familia y el usuario deberá iniciar sesión otra vez.
   */
  async refresh(rawToken: string | undefined, client: ClientInfo = {}): Promise<SesionEmitida> {
    if (!rawToken) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { usuario: { include: { rol: true } } },
    });

    if (!stored) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    if (stored.revocadoEn) {
      await this.revocarFamilia(stored.familia);
      this.logger.warn(
        `Reutilización de refresh token detectada (usuario ID ${stored.usuarioId}). Sesión revocada.`,
      );
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    if (stored.expiraEn <= new Date() || stored.usuario.estado !== 'activo') {
      await this.revocarFamilia(stored.familia);
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    // Revocación condicional: si dos peticiones usan el mismo token a la vez, solo una gana
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    if (count !== 1) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    return this.emitirSesion(stored.usuario, {
      familia: stored.familia,
      recordar: stored.recordar,
      // Expiración absoluta: rotar no extiende la vida de la sesión
      expiraEn: stored.expiraEn,
      client,
    });
  }

  /**
   * Cierra la sesión revocando toda la familia del refresh token.
   */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      select: { familia: true, usuarioId: true },
    });

    if (stored) {
      await this.revocarFamilia(stored.familia);
      this.logger.log(`Logout: usuario ID ${stored.usuarioId}`);
    }
  }

  /**
   * Solicitud de restablecimiento. Responde siempre lo mismo y procesa en segundo
   * plano para que ni el contenido ni el tiempo de respuesta revelen si el email existe.
   */
  forgotPassword(forgotPasswordDto: ForgotPasswordDto): { message: string } {
    const email = forgotPasswordDto.email.trim().toLowerCase();

    void this.procesarSolicitudReset(email).catch((err: Error) =>
      this.logger.error(`Error procesando solicitud de restablecimiento: ${err.message}`),
    );

    return { message: MENSAJE_SOLICITUD_RESET };
  }

  /**
   * Restablece la contraseña con un token de un solo uso. Invalida todas las
   * sesiones abiertas del usuario (access y refresh tokens).
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const registro = await this.prisma.passwordResetToken.findUnique({
      where: { token: sha256(resetPasswordDto.token) },
      include: { usuario: { select: { id: true, email: true, nombre: true } } },
    });

    if (!registro || registro.usado || registro.expiraEn <= new Date()) {
      throw new BadRequestException(ENLACE_INVALIDO);
    }

    const passwordHash = await bcrypt.hash(resetPasswordDto.newPassword, this.bcryptRounds);
    const ahora = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Consumo condicional del token: evita el doble uso concurrente
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: registro.id, usado: false },
        data: { usado: true },
      });
      if (count !== 1) {
        throw new BadRequestException(ENLACE_INVALIDO);
      }

      await tx.usuario.update({
        where: { id: registro.usuarioId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.passwordResetToken.updateMany({
        where: { usuarioId: registro.usuarioId, usado: false },
        data: { usado: true },
      });
      await tx.refreshToken.updateMany({
        where: { usuarioId: registro.usuarioId, revocadoEn: null },
        data: { revocadoEn: ahora },
      });
    });

    this.clearFailures(registro.usuario.email.toLowerCase());
    this.logger.log(`Contraseña restablecida: usuario ID ${registro.usuarioId}`);

    void this.mailService
      .enviarAvisoCambioPassword(registro.usuario)
      .catch((err: Error) =>
        this.logger.error(`No se pudo enviar el aviso de cambio de contraseña: ${err.message}`),
      );

    return {
      message: 'Contraseña restablecida exitosamente. Puede iniciar sesión con su nueva contraseña.',
    };
  }

  /**
   * Perfil del usuario autenticado (sin datos sensibles).
   */
  async getProfile(userId: number): Promise<UsuarioPublico> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: { rol: true },
    });

    if (!usuario) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    return this.toUsuarioPublico(usuario);
  }

  // ─── Emisión de tokens ──────────────────────────────────────────────

  private async emitirSesion(
    usuario: UsuarioConRol,
    opciones: { familia: string; recordar: boolean; expiraEn?: Date; client: ClientInfo },
  ): Promise<SesionEmitida> {
    const payload: AccessTokenPayload = {
      sub: usuario.id,
      rolId: usuario.rolId,
      ver: usuario.tokenVersion,
      typ: 'access',
    };
    const accessToken = await this.jwtService.signAsync(payload);

    // Refresh token opaco (no JWT): solo sirve contra /auth/refresh y es revocable
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiraEn =
      opciones.expiraEn ??
      new Date(Date.now() + (opciones.recordar ? this.rememberTtlMs : this.sessionTtlMs));

    await this.prisma.refreshToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: sha256(refreshToken),
        familia: opciones.familia,
        recordar: opciones.recordar,
        expiraEn: refreshExpiraEn,
        ip: opciones.client.ip?.slice(0, 45),
        userAgent: opciones.client.userAgent?.slice(0, 255),
      },
    });

    return {
      accessToken,
      expiresIn: this.accessTtlSeconds,
      refreshToken,
      refreshExpiraEn,
      recordar: opciones.recordar,
      user: this.toUsuarioPublico(usuario),
    };
  }

  private async revocarFamilia(familia: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familia, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  private async procesarSolicitudReset(email: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true, email: true, nombre: true, estado: true },
    });

    if (!usuario || usuario.estado !== 'activo') {
      this.logger.warn(`Solicitud de restablecimiento para cuenta inexistente o inactiva: ${email}`);
      return;
    }

    const ahora = Date.now();
    const solicitudReciente = await this.prisma.passwordResetToken.findFirst({
      where: {
        usuarioId: usuario.id,
        usado: false,
        expiraEn: { gt: new Date(ahora) },
        creadoEn: { gt: new Date(ahora - this.RESET_COOLDOWN_MS) },
      },
      select: { id: true },
    });
    if (solicitudReciente) {
      this.logger.warn(`Solicitud de restablecimiento repetida ignorada: usuario ID ${usuario.id}`);
      return;
    }

    // Token aleatorio de 256 bits; en la BD solo se guarda su hash
    const resetToken = randomBytes(32).toString('hex');

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { usuarioId: usuario.id, usado: false },
        data: { usado: true },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          usuarioId: usuario.id,
          token: sha256(resetToken),
          expiraEn: new Date(ahora + this.resetTtlMinutes * 60 * 1000),
        },
      }),
    ]);

    // En el fragmento (#): el navegador no lo envía al servidor ni en el Referer
    const enlace = `${this.frontendUrl}/reset-password#token=${resetToken}`;
    await this.mailService.enviarRestablecimiento(usuario, enlace, this.resetTtlMinutes);
    this.logger.log(`Enlace de restablecimiento emitido: usuario ID ${usuario.id}`);
  }

  private async compararPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      // Hash corrupto o en formato no bcrypt: se trata como credencial inválida
      return false;
    }
  }

  private toUsuarioPublico(usuario: UsuarioConRol): UsuarioPublico {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono,
      estado: usuario.estado,
      ultimoAcceso: usuario.ultimoAcceso,
      rol: {
        id: usuario.rol.id,
        nombre: usuario.rol.nombre,
        descripcion: usuario.rol.descripcion,
      },
    };
  }

  // ─── Protección contra fuerza bruta ─────────────────────────────────
  // Se aplica igual a emails existentes e inexistentes para no permitir enumeración.

  private assertNotLocked(email: string): void {
    const intentos = this.failedAttempts.get(email);
    if (intentos?.lockedUntil && intentos.lockedUntil > Date.now()) {
      const minutos = Math.ceil((intentos.lockedUntil - Date.now()) / 60_000);
      throw new HttpException(
        `Demasiados intentos fallidos. Intente de nuevo en ${minutos} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerFailure(email: string): void {
    const ahora = Date.now();
    let intentos = this.failedAttempts.get(email);

    if (!intentos || ahora - intentos.lastFailureAt > this.LOCKOUT_DURATION_MS) {
      intentos = { count: 0, lastFailureAt: ahora, lockedUntil: null };
    }

    intentos.count += 1;
    intentos.lastFailureAt = ahora;

    if (intentos.count >= this.MAX_FAILED_ATTEMPTS) {
      intentos.lockedUntil = ahora + this.LOCKOUT_DURATION_MS;
      intentos.count = 0;
      this.logger.warn(`Cuenta bloqueada temporalmente por intentos fallidos: ${email}`);
    }

    this.failedAttempts.delete(email);
    this.failedAttempts.set(email, intentos);
    this.pruneFailedAttempts(ahora);
  }

  private clearFailures(email: string): void {
    this.failedAttempts.delete(email);
  }

  // Limita la memoria usada por el registro de intentos (evita DoS por emails aleatorios)
  private pruneFailedAttempts(ahora: number): void {
    if (this.failedAttempts.size <= this.MAX_TRACKED_EMAILS) return;

    for (const [email, intentos] of this.failedAttempts) {
      const bloqueado = intentos.lockedUntil !== null && intentos.lockedUntil > ahora;
      if (!bloqueado && ahora - intentos.lastFailureAt > this.LOCKOUT_DURATION_MS) {
        this.failedAttempts.delete(email);
      }
    }

    // Si aún excede el límite, se descartan los registros más antiguos
    for (const email of this.failedAttempts.keys()) {
      if (this.failedAttempts.size <= this.MAX_TRACKED_EMAILS) break;
      this.failedAttempts.delete(email);
    }
  }
}
