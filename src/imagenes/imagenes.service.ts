import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type CarpetaImagen = 'vehiculos' | 'usuarios';

export interface ArchivoImagen {
  buffer: Buffer;
}

export interface ImagenEnDisco {
  ruta: string;
  tipo: string;
}

export const TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024;

export const OPCIONES_SUBIDA_IMAGEN = {
  limits: { fileSize: TAMANO_MAXIMO_IMAGEN, files: 1 },
};

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const FORMATOS = [
  {
    extension: 'jpg',
    tipo: 'image/jpeg',
    coincide: (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    extension: 'png',
    tipo: 'image/png',
    coincide: (b: Buffer) => b.length > 8 && b.subarray(0, 8).equals(FIRMA_PNG),
  },
  {
    extension: 'webp',
    tipo: 'image/webp',
    coincide: (b: Buffer) =>
      b.length > 12 &&
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
] as const;

const NOMBRE_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

@Injectable()
export class ImagenesService {
  private readonly raiz: string;

  constructor(config: ConfigService) {
    this.raiz = path.resolve(config.get<string>('UPLOADS_DIR') || 'uploads');
  }

  async guardar(carpeta: CarpetaImagen, archivo: ArchivoImagen | undefined): Promise<string> {
    if (!archivo?.buffer?.length) {
      throw new BadRequestException('Adjunte una imagen en el campo "foto"');
    }

    const formato = FORMATOS.find((f) => f.coincide(archivo.buffer));
    if (!formato) {
      throw new BadRequestException('Formato de imagen no permitido: use JPG, PNG o WEBP');
    }

    const nombre = `${randomUUID()}.${formato.extension}`;
    const directorio = path.join(this.raiz, carpeta);
    await mkdir(directorio, { recursive: true });
    await writeFile(path.join(directorio, nombre), archivo.buffer, { flag: 'wx' });
    return nombre;
  }

  async obtener(carpeta: CarpetaImagen, nombre: string | null | undefined): Promise<ImagenEnDisco> {
    const formato = nombre && NOMBRE_VALIDO.test(nombre)
      ? FORMATOS.find((f) => nombre.endsWith(`.${f.extension}`))
      : undefined;
    if (!nombre || !formato) {
      throw new NotFoundException('La imagen no existe');
    }

    const ruta = path.join(this.raiz, carpeta, nombre);
    try {
      await access(ruta);
    } catch {
      throw new NotFoundException('La imagen no existe');
    }
    return { ruta, tipo: formato.tipo };
  }

  async eliminar(carpeta: CarpetaImagen, nombre: string | null | undefined): Promise<void> {
    if (!nombre || !NOMBRE_VALIDO.test(nombre)) return;
    await rm(path.join(this.raiz, carpeta, nombre), { force: true });
  }
}
