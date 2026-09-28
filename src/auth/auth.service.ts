import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// Interfaz del payload JWT
interface JwtPayload {
  sub: number;
  email: string;
  rolId: number;
  nombre: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Configuración OWASP: máximo de intentos fallidos antes de bloqueo temporal
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos
  private readonly RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hora
  private readonly BCRYPT_SALT_ROUNDS = 12;

  // Almacén en memoria para rate-limiting de intentos de login (en producción usar Redis)
  private failedAttempts = new Map<string, { count: number; lockedUntil: Date | null }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Autenticación de usuario con email y contraseña.
   * Incluye protección contra fuerza bruta con lockout temporal.
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Verificar si la cuenta está bloqueada por intentos fallidos
    this.checkAccountLockout(email);

    // Buscar usuario por email incluyendo el hash de contraseña
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { rol: true },
    });

    if (!usuario) {
      this.recordFailedAttempt(email);
      this.logger.warn(`Intento de login fallido - email no encontrado: ${email}`);
      // Mensaje genérico para no revelar si el email existe (OWASP A07)
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que el usuario esté activo
    if (usuario.estado !== 'activo') {
      this.logger.warn(`Intento de login con cuenta ${usuario.estado}: ${email}`);
      throw new UnauthorizedException(
        'Su cuenta se encuentra inactiva o suspendida. Contacte al administrador.',
      );
    }

    // Verificar contraseña con bcrypt
    const isPasswordValid = await bcrypt.compare(password, usuario.passwordHash);

    if (!isPasswordValid) {
      this.recordFailedAttempt(email);
      this.logger.warn(`Contraseña incorrecta para: ${email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Login exitoso: limpiar intentos fallidos
    this.clearFailedAttempts(email);

    // Actualizar último acceso
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    // Generar tokens JWT
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rolId: usuario.rolId,
      nombre: usuario.nombre,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '1h',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    this.logger.log(`Login exitoso: ${email}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        telefono: usuario.telefono,
        estado: usuario.estado,
        rol: usuario.rol,
        ultimoAcceso: usuario.ultimoAcceso,
      },
    };
  }

  /**
   * Renovar access token usando un refresh token válido.
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);

      // Verificar que el usuario aún existe y está activo
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: payload.sub },
        include: { rol: true },
      });

      if (!usuario || usuario.estado !== 'activo') {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      const newPayload: JwtPayload = {
        sub: usuario.id,
        email: usuario.email,
        rolId: usuario.rolId,
        nombre: usuario.nombre,
      };

      const accessToken = await this.jwtService.signAsync(newPayload, {
        expiresIn: '1h',
      });

      return { accessToken };
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  /**
   * Solicitar restablecimiento de contraseña.
   * Genera un token seguro y lo almacena en la base de datos.
   * NOTA: En producción aquí se enviaría un email con el link de reset.
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
    });

    // Siempre respondemos con éxito para no revelar si el email existe (OWASP A07)
    if (!usuario) {
      this.logger.warn(`Solicitud de reset para email inexistente: ${email}`);
      return {
        message: 'Si el email está registrado, recibirá instrucciones para restablecer su contraseña.',
      };
    }

    // Invalidar tokens anteriores no usados
    await this.prisma.passwordResetToken.updateMany({
      where: {
        usuarioId: usuario.id,
        usado: false,
      },
      data: { usado: true },
    });

    // Generar token criptográficamente seguro
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Guardar token hasheado en la base de datos
    await this.prisma.passwordResetToken.create({
      data: {
        usuarioId: usuario.id,
        token: hashedToken,
        expiraEn: new Date(Date.now() + this.RESET_TOKEN_EXPIRY_MS),
      },
    });

    this.logger.log(`Token de reset generado para: ${email}`);

    // En producción: enviar email con link que contenga resetToken
    // Por ahora devolvemos el token para testing
    return {
      message: 'Si el email está registrado, recibirá instrucciones para restablecer su contraseña.',
      // SOLO PARA DESARROLLO - remover en producción
      resetToken,
    };
  }

  /**
   * Restablecer contraseña usando un token válido.
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // Hashear el token recibido para comparar con el almacenado
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar el token en la base de datos
    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
      include: { usuario: true },
    });

    if (!resetRecord) {
      throw new BadRequestException('Token de restablecimiento inválido');
    }

    if (resetRecord.usado) {
      throw new BadRequestException('Este token ya ha sido utilizado');
    }

    if (new Date() > resetRecord.expiraEn) {
      throw new BadRequestException('El token de restablecimiento ha expirado');
    }

    // Hashear la nueva contraseña
    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);

    // Actualizar contraseña y marcar token como usado en una transacción
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: resetRecord.usuarioId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usado: true },
      }),
    ]);

    this.logger.log(`Contraseña restablecida exitosamente para usuario ID: ${resetRecord.usuarioId}`);

    return {
      message: 'Contraseña restablecida exitosamente. Puede iniciar sesión con su nueva contraseña.',
    };
  }

  /**
   * Obtener perfil del usuario autenticado.
   */
  async getProfile(userId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: { rol: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Nunca devolver el hash de la contraseña
    const { passwordHash: _, ...userWithoutPassword } = usuario;
    return userWithoutPassword;
  }

  // ─── Métodos privados de protección contra fuerza bruta ─────────────

  private checkAccountLockout(email: string): void {
    const attempts = this.failedAttempts.get(email);
    if (attempts?.lockedUntil && new Date() < attempts.lockedUntil) {
      const remainingMs = attempts.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new UnauthorizedException(
        `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente de nuevo en ${remainingMin} minuto(s).`,
      );
    }
  }

  private recordFailedAttempt(email: string): void {
    const attempts = this.failedAttempts.get(email) || { count: 0, lockedUntil: null };
    attempts.count += 1;

    if (attempts.count >= this.MAX_FAILED_ATTEMPTS) {
      attempts.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION_MS);
      this.logger.warn(`Cuenta bloqueada por intentos fallidos: ${email}`);
    }

    this.failedAttempts.set(email, attempts);
  }

  private clearFailedAttempts(email: string): void {
    this.failedAttempts.delete(email);
  }
}
