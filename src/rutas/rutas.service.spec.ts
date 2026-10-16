import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RutasService } from './rutas.service.js';

describe('RutasService', () => {
  let service: RutasService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      cliente: {
        findUnique: vi.fn(),
      },
      puntoCargaDescarga: {
        findUnique: vi.fn(),
      },
      ruta: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    service = new RutasService(prismaMock);
  });

  describe('create', () => {
    it('debe lanzar NotFoundException si el cliente no existe', async () => {
      prismaMock.cliente.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          idCliente: 'c1111111-1111-4111-8111-111111111111',
          nombreRuta: 'Caracas - Valencia',
          ciudadOrigen: 'Caracas',
          ciudadDestino: 'Valencia',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar NotFoundException si el punto de origen no existe', async () => {
      prismaMock.cliente.findUnique.mockResolvedValue({ idCliente: 'c1111111-1111-4111-8111-111111111111' });
      prismaMock.puntoCargaDescarga.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          idCliente: 'c1111111-1111-4111-8111-111111111111',
          nombreRuta: 'Caracas - Valencia',
          ciudadOrigen: 'Caracas',
          ciudadDestino: 'Valencia',
          idPuntoOrigen: 'p1111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el origen y destino son el mismo punto', async () => {
      const idCliente = 'c1111111-1111-4111-8111-111111111111';
      const idPunto = 'p1111111-1111-4111-8111-111111111111';
      prismaMock.cliente.findUnique.mockResolvedValue({ idCliente });
      prismaMock.puntoCargaDescarga.findUnique.mockResolvedValue({ idPunto, idCliente });

      await expect(
        service.create({
          idCliente,
          nombreRuta: 'Ruta Circular',
          ciudadOrigen: 'Caracas',
          ciudadDestino: 'Caracas',
          idPuntoOrigen: idPunto,
          idPuntoDestino: idPunto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe crear una ruta correctamente cuando los datos son válidos con tarifa', async () => {
      const idCliente = 'c1111111-1111-4111-8111-111111111111';
      prismaMock.cliente.findUnique.mockResolvedValue({ idCliente });
      prismaMock.ruta.create.mockResolvedValue({
        idRuta: 'r1111111-1111-4111-8111-111111111111',
        nombreRuta: 'Caracas - Valencia',
        montoTarifa: 450.0,
        tipoCobro: 'Por_Viaje_Fijo',
        moneda: 'USD',
      });

      const res = await service.create({
        idCliente,
        nombreRuta: 'Caracas - Valencia',
        ciudadOrigen: 'Caracas',
        ciudadDestino: 'Valencia',
        distanciaKm: 165.5,
        montoTarifa: 450.0,
        tipoCobro: 'Por_Viaje_Fijo' as any,
        moneda: 'USD',
      });

      expect(res).toBeDefined();
      expect(prismaMock.ruta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            montoTarifa: 450.0,
            tipoCobro: 'Por_Viaje_Fijo',
            moneda: 'USD',
          }),
        }),
      );
    });

    it('debe usar valores por defecto para tarifa si no se especifican al crear', async () => {
      const idCliente = 'c1111111-1111-4111-8111-111111111111';
      prismaMock.cliente.findUnique.mockResolvedValue({ idCliente });
      prismaMock.ruta.create.mockResolvedValue({
        idRuta: 'r1111111-1111-4111-8111-111111111111',
        nombreRuta: 'Caracas - Maracay',
      });

      await service.create({
        idCliente,
        nombreRuta: 'Caracas - Maracay',
        ciudadOrigen: 'Caracas',
        ciudadDestino: 'Maracay',
      });

      expect(prismaMock.ruta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            montoTarifa: 0,
            tipoCobro: 'Por_Viaje_Fijo',
            moneda: 'USD',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('debe actualizar los campos de tarifa de una ruta existente', async () => {
      const idRuta = 'r1111111-1111-4111-8111-111111111111';
      const idCliente = 'c1111111-1111-4111-8111-111111111111';

      prismaMock.ruta.findUnique.mockResolvedValue({
        idRuta,
        idCliente,
        nombreRuta: 'Caracas - Valencia',
        ciudadOrigen: 'Caracas',
        ciudadDestino: 'Valencia',
        idPuntoOrigen: null,
        idPuntoDestino: null,
      });

      prismaMock.cliente.findUnique.mockResolvedValue({ idCliente });
      prismaMock.ruta.update.mockResolvedValue({
        idRuta,
        montoTarifa: 550.0,
        tipoCobro: 'Por_Tonelada',
        moneda: 'USD',
      });

      const res = await service.update(idRuta, {
        montoTarifa: 550.0,
        tipoCobro: 'Por_Tonelada' as any,
      });

      expect(res).toBeDefined();
      expect(prismaMock.ruta.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idRuta },
          data: expect.objectContaining({
            montoTarifa: 550.0,
            tipoCobro: 'Por_Tonelada',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('debe lanzar NotFoundException si la ruta no existe', async () => {
      prismaMock.ruta.findUnique.mockResolvedValue(null);

      await expect(service.findOne('r9999999-9999-4999-8999-999999999999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe retornar la ruta si existe', async () => {
      const rutaMock = { idRuta: 'r1111111-1111-4111-8111-111111111111', nombreRuta: 'Caracas - Valencia' };
      prismaMock.ruta.findUnique.mockResolvedValue(rutaMock);

      const res = await service.findOne('r1111111-1111-4111-8111-111111111111');
      expect(res).toEqual(rutaMock);
    });
  });

  describe('remove', () => {
    it('debe lanzar BadRequestException si la ruta tiene guías asociadas', async () => {
      prismaMock.ruta.findUnique.mockResolvedValue({
        idRuta: 'r1111111-1111-4111-8111-111111111111',
        _count: { guiasViajes: 3 },
      });

      await expect(service.remove('r1111111-1111-4111-8111-111111111111')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe eliminar la ruta si no tiene guías asociadas', async () => {
      prismaMock.ruta.findUnique.mockResolvedValue({
        idRuta: 'r1111111-1111-4111-8111-111111111111',
        _count: { guiasViajes: 0 },
      });
      prismaMock.ruta.delete.mockResolvedValue({ idRuta: 'r1111111-1111-4111-8111-111111111111' });

      const res = await service.remove('r1111111-1111-4111-8111-111111111111');
      expect(res).toBeDefined();
      expect(prismaMock.ruta.delete).toHaveBeenCalled();
    });
  });
});
