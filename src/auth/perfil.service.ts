import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImagenesService, type ArchivoImagen } from '../imagenes/imagenes.service.js';
import { AuthService, type UsuarioPublico } from './auth.service.js';

@Injectable()
export class PerfilService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagenes: ImagenesService,
    private readonly authService: AuthService,
  ) {}

  async actualizarFoto(usuarioId: string, archivo: ArchivoImagen | undefined): Promise<UsuarioPublico> {
    const actual = await this.fotoActual(usuarioId);
    const foto = await this.imagenes.guardar('usuarios', archivo);

    try {
      await this.prisma.usuario.update({ where: { id: usuarioId }, data: { foto } });
    } catch (error) {
      await this.imagenes.eliminar('usuarios', foto);
      throw error;
    }

    await this.imagenes.eliminar('usuarios', actual);
    return this.authService.getProfile(usuarioId);
  }

  async obtenerFoto(usuarioId: string) {
    return this.imagenes.obtener('usuarios', await this.fotoActual(usuarioId));
  }

  async eliminarFoto(usuarioId: string): Promise<UsuarioPublico> {
    const actual = await this.fotoActual(usuarioId);
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { foto: null } });
    await this.imagenes.eliminar('usuarios', actual);
    return this.authService.getProfile(usuarioId);
  }

  private async fotoActual(usuarioId: string): Promise<string | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { foto: true },
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return usuario.foto;
  }
}
