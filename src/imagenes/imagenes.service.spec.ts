import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ImagenesService } from './imagenes.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

describe('ImagenesService', () => {
  let raiz: string;
  let servicio: ImagenesService;

  beforeEach(() => {
    raiz = mkdtempSync(path.join(tmpdir(), 'flota-imagenes-'));
    servicio = new ImagenesService(new ConfigService({ UPLOADS_DIR: raiz }));
  });

  afterEach(() => {
    rmSync(raiz, { recursive: true, force: true });
  });

  it.each([
    ['PNG', PNG, 'png', 'image/png'],
    ['JPG', JPG, 'jpg', 'image/jpeg'],
    ['WEBP', WEBP, 'webp', 'image/webp'],
  ])('guarda una imagen %s con nombre UUID y la recupera con su tipo', async (_formato, buffer, extension, tipo) => {
    const nombre = await servicio.guardar('vehiculos', { buffer });

    expect(nombre).toMatch(new RegExp(`^[0-9a-f-]{36}\\.${extension}$`));
    expect(existsSync(path.join(raiz, 'vehiculos', nombre))).toBe(true);
    await expect(servicio.obtener('vehiculos', nombre)).resolves.toEqual({
      ruta: path.join(raiz, 'vehiculos', nombre),
      tipo,
    });
  });

  it.each([
    ['sin archivo', undefined],
    ['archivo vacío', { buffer: Buffer.alloc(0) }],
    ['GIF', { buffer: Buffer.from('GIF89a......') }],
    ['SVG', { buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }],
    ['texto con extensión de imagen', { buffer: Buffer.from('no soy una imagen') }],
  ])('rechaza %s', async (_caso, archivo) => {
    await expect(servicio.guardar('usuarios', archivo)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('elimina la imagen del disco y luego responde 404 al pedirla', async () => {
    const nombre = await servicio.guardar('usuarios', { buffer: PNG });

    await servicio.eliminar('usuarios', nombre);

    expect(existsSync(path.join(raiz, 'usuarios', nombre))).toBe(false);
    await expect(servicio.obtener('usuarios', nombre)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([null, '../../.env', '..\\..\\.env', 'foto.png', '00000000-0000-0000-0000-000000000000.png'])(
    'no resuelve nombres inválidos (%s)',
    async (nombre) => {
      await expect(servicio.obtener('vehiculos', nombre)).rejects.toBeInstanceOf(NotFoundException);
      await expect(servicio.eliminar('vehiculos', nombre)).resolves.toBeUndefined();
    },
  );
});
