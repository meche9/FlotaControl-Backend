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

  async enviarCodigoRegistro(destinatario: Destinatario, codigo: string, minutosValidez: number) {
    const nombre = escapeHtml(destinatario.nombre);
    await this.enviar(destinatario.email, 'Código de verificación - FleetFlow', {
      texto:
        `Hola ${destinatario.nombre},\n\n` +
        `Su código de verificación para completar su registro en FleetFlow es:\n\n` +
        `${codigo}\n\n` +
        `Este código es válido por ${minutosValidez} minutos.\n` +
        `Si usted no solicitó este registro, ignore este mensaje.`,
      html:
        `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">` +
        `<h2 style="color: #0f172a; margin-top: 0;">Verifica tu correo electrónico</h2>` +
        `<p style="color: #475569;">Hola <strong>${nombre}</strong>,</p>` +
        `<p style="color: #475569;">Hemos recibido tu solicitud de registro. Ingresa el siguiente código de 6 dígitos para verificar tu cuenta:</p>` +
        `<div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 16px; text-align: center; margin: 24px 0; border-radius: 8px;">` +
        `<span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #f97316;">${escapeHtml(codigo)}</span>` +
        `</div>` +
        `<p style="color: #64748b; font-size: 13px;">Este código tiene una vigencia de ${minutosValidez} minutos y expira automáticamente.</p>` +
        `<p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Si no solicitaste una cuenta en FleetFlow, puedes ignorar este mensaje.</p>` +
        `</div>`,
      enlaceDev: `Código OTP: ${codigo}`,
    });
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
