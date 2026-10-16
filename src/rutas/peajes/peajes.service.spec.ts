import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PeajesService } from './peajes.service.js';

describe('PeajesService', () => {
  let service: PeajesService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      peajeVzla: {
        findMany: vi.fn(),
      },
      ruta: {
        findUnique: vi.fn(),
      },
      rutaPeaje: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prismaMock)),
    };

    service = new PeajesService(prismaMock);
  });

  describe('getCatalogoVzla', () => {
    it('debe retornar catálogo ordenado de peajes_vzla', async () => {
      const mockPeajes = [
        { idPeaje: 1, nombrePeaje: 'Guacara', estadoUbicacion: 'Carabobo', activo: true },
        { idPeaje: 2, nombrePeaje: 'La Cabrera', estadoUbicacion: 'Aragua', activo: true },
      ];
      prismaMock.peajeVzla.findMany.mockResolvedValue(mockPeajes);

      const result = await service.getCatalogoVzla();
      expect(result).toEqual(mockPeajes);
      expect(prismaMock.peajeVzla.findMany).toHaveBeenCalledWith({
        where: { activo: true },
        orderBy: [{ estadoUbicacion: 'asc' }, { nombrePeaje: 'asc' }],
      });
    });
  });

  describe('findByRuta', () => {
    it('debe lanzar NotFoundException si la ruta no existe', async () => {
      prismaMock.ruta.findUnique.mockResolvedValue(null);

      await expect(service.findByRuta('r1111111-1111-4111-8111-111111111111')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe retornar peajes asignados ordenados por orden asc', async () => {
      prismaMock.ruta.findUnique.mockResolvedValue({ idRuta: 'r111' });
      const mockAsignados = [
        { idRutaPeaje: 'rp1', idRuta: 'r111', nombrePeaje: 'Guacara', orden: 1, costo: 2.5 },
      ];
      prismaMock.rutaPeaje.findMany.mockResolvedValue(mockAsignados);

      const result = await service.findByRuta('r111');
      expect(result).toEqual(mockAsignados);
      expect(prismaMock.rutaPeaje.findMany).toHaveBeenCalledWith({
        where: { idRuta: 'r111' },
        orderBy: { orden: 'asc' },
      });
    });
  });

  describe('syncPeajesRuta', () => {
    it('debe reemplazar en transacción los peajes asignados de la ruta', async () => {
      prismaMock.ruta.findUnique.mockResolvedValue({ idRuta: 'r111' });
      prismaMock.rutaPeaje.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.rutaPeaje.createMany.mockResolvedValue({ count: 2 });
      prismaMock.rutaPeaje.findMany.mockResolvedValue([
        { idRutaPeaje: 'rp1', idRuta: 'r111', nombrePeaje: 'Guacara', orden: 1, costo: 2.5 },
        { idRutaPeaje: 'rp2', idRuta: 'r111', nombrePeaje: 'La Cabrera', orden: 2, costo: 2.5 },
      ]);

      const result = await service.syncPeajesRuta('r111', [
        { nombrePeaje: 'Guacara', orden: 1, costo: 2.5, activo: true },
        { nombrePeaje: 'La Cabrera', orden: 2, costo: 2.5, activo: true },
      ]);

      expect(prismaMock.rutaPeaje.deleteMany).toHaveBeenCalledWith({ where: { idRuta: 'r111' } });
      expect(prismaMock.rutaPeaje.createMany).toHaveBeenCalled();
      expect(result.length).toBe(2);
    });
  });
});
