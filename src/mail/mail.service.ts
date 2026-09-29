import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface Destinatario {
  email: string;
  nombre: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly isProduction: boolean;

  constructor(private readonly config: ConfigService) {
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
    this.from = this.config.get<string>('SMTP_FROM') ?? 'FleetFlow <no-reply@fleetflow.local>';

    const host = this.config.get<string>('SMTP_HOST');
    this.transporter = host
      ? createTransport({
          host,
          port: this.config.get<number>('SMTP_PORT'),
          secure: this.config.get<boolean>('SMTP_SECURE'),
          auth: this.config.get<string>('SMTP_USER')
            ? {
                user: this.config.get<string>('SMTP_USER'),
                pass: this.config.get<string>('SMTP_PASS'),
              }
            : undefined,
        })
      : null;
  }

  async enviarRestablecimiento(destinatario: Destinatario, enlace: string, minutosValidez: number) {
    const nombre = escapeHtml(destinatario.nombre);
    await this.enviar(destinatario.email, 'Restablecer contraseña - FleetFlow', {
      texto:
        `Hola ${destinatario.nombre},\n\n` +
        `Recibimos una solicitud para restablecer su contraseña. Use el siguiente enlace ` +
        `(válido por ${minutosValidez} minutos y de un solo uso):\n\n${enlace}\n\n` +
        `Si usted no lo solicitó, ignore este mensaje: su contraseña no cambiará.`,
      html:
        `<p>Hola ${nombre},</p>` +
        `<p>Recibimos una solicitud para restablecer su contraseña.</p>` +
        `<p><a href="${escapeHtml(enlace)}">Restablecer contraseña</a></p>` +
        `<p>El enlace es válido por ${minutosValidez} minutos y solo puede usarse una vez.</p>` +
        `<p>Si usted no lo solicitó, ignore este mensaje: su contraseña no cambiará.</p>`,
      // El enlace contiene un secreto: solo se registra en desarrollo sin SMTP
      enlaceDev: enlace,
    });
  }

  async enviarAvisoCambioPassword(destinatario: Destinatario) {
    const nombre = escapeHtml(destinatario.nombre);
    await this.enviar(destinatario.email, 'Su contraseña fue cambiada - FleetFlow', {
      texto:
        `Hola ${destinatario.nombre},\n\n` +
        `La contraseña de su cuenta FleetFlow fue cambiada y se cerraron todas las sesiones abiertas.\n` +
        `Si no fue usted, contacte de inmediato al administrador.`,
      html:
        `<p>Hola ${nombre},</p>` +
        `<p>La contraseña de su cuenta FleetFlow fue cambiada y se cerraron todas las sesiones abiertas.</p>` +
        `<p>Si no fue usted, contacte de inmediato al administrador.</p>`,
    });
  }

  private async enviar(
    to: string,
    subject: string,
    contenido: { texto: string; html: string; enlaceDev?: string },
  ) {
    if (!this.transporter) {
      if (this.isProduction) {
        this.logger.error(`SMTP no configurado: no se pudo enviar "${subject}"`);
        return;
      }
      this.logger.warn(
        `[DEV sin SMTP] Correo "${subject}" para ${to}` +
          (contenido.enlaceDev ? `\n  Enlace: ${contenido.enlaceDev}` : ''),
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text: contenido.texto,
      html: contenido.html,
    });
  }
}
