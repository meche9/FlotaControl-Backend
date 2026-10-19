import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreatePuntoCargaDto } from './dto/create-cargasdescargas.js';
import { UpdatePuntoCargaDto } from './dto/update-cargasdescargas.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PuntosCargaService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createPuntoCargaDto: CreatePuntoCargaDto) {
        // Validar que el cliente exista previamente
        const clienteExists = await this.prisma.cliente.findUnique({
            where: { idCliente: createPuntoCargaDto.idCliente },
        });

        if (!clienteExists) {
            throw new NotFoundException(`Cliente con ID ${createPuntoCargaDto.idCliente} no fue encontrado.`);
        }

        const codigoNormalizado = createPuntoCargaDto.codigoPuntoc?.trim().toUpperCase();
        if (!codigoNormalizado) {
            throw new BadRequestException('El código del punto (codigoPuntoc) es obligatorio.');
        }

        // Verificar que este código no exista para el mismo cliente
        const puntoExistente = await this.prisma.puntoCargaDescarga.findFirst({
            where: {
                idCliente: createPuntoCargaDto.idCliente,
                codigoPuntoc: codigoNormalizado,
            },
        });

        if (puntoExistente) {
            throw new ConflictException(
                `Ya existe un punto de carga/descarga con el código "${codigoNormalizado}" para el cliente seleccionado.`
            );
        }

        return this.prisma.puntoCargaDescarga.create({
            data: {
                ...createPuntoCargaDto,
                codigoPuntoc: codigoNormalizado,
            },
        });
    }

    async findAll() {
        return this.prisma.puntoCargaDescarga.findMany({
            include: { cliente: true },
            orderBy: { fechaCreacion: 'desc' },
        });
    }

    async findByCliente(idCliente: string) {
        // Validar que el cliente exista
        const clienteExists = await this.prisma.cliente.findUnique({
            where: { idCliente },
        });

        if (!clienteExists) {
            throw new NotFoundException(`Cliente con ID ${idCliente} no fue encontrado.`);
        }

        return this.prisma.puntoCargaDescarga.findMany({
            where: { idCliente },
            orderBy: { fechaCreacion: 'desc' },
        });
    }

    async checkCodigoExists(idCliente: string, codigo: string, excludeId?: string): Promise<boolean> {
        const codigoNormalizado = codigo?.trim().toUpperCase();
        if (!codigoNormalizado || !idCliente) return false;

        const where: any = {
            idCliente,
            codigoPuntoc: codigoNormalizado,
        };

        if (excludeId) {
            where.NOT = { idPunto: excludeId };
        }

        const existe = await this.prisma.puntoCargaDescarga.findFirst({ where });
        return Boolean(existe);
    }

    async findOne(id: string) {
        const punto = await this.prisma.puntoCargaDescarga.findUnique({
            where: { idPunto: id },
            include: { cliente: true },
        });

        if (!punto) {
            throw new NotFoundException(`Punto de carga/descarga con ID ${id} no fue encontrado.`);
        }

        return punto;
    }

    async update(id: string, updatePuntoCargaDto: UpdatePuntoCargaDto) {
        const puntoActual = await this.findOne(id); // Valida existencia del punto

        const targetClienteId = updatePuntoCargaDto.idCliente || puntoActual.idCliente;

        if (updatePuntoCargaDto.idCliente) {
            const clienteExists = await this.prisma.cliente.findUnique({
                where: { idCliente: updatePuntoCargaDto.idCliente },
            });
            if (!clienteExists) {
                throw new NotFoundException(`Cliente con ID ${updatePuntoCargaDto.idCliente} no fue encontrado.`);
            }
        }

        let codigoNormalizado = updatePuntoCargaDto.codigoPuntoc?.trim().toUpperCase();
        if (codigoNormalizado) {
            const puntoExistente = await this.prisma.puntoCargaDescarga.findFirst({
                where: {
                    idCliente: targetClienteId,
                    codigoPuntoc: codigoNormalizado,
                    NOT: { idPunto: id },
                },
            });

            if (puntoExistente) {
                throw new ConflictException(
                    `Ya existe un punto de carga/descarga con el código "${codigoNormalizado}" para este cliente.`
                );
            }
        }

        return this.prisma.puntoCargaDescarga.update({
            where: { idPunto: id },
            data: {
                ...updatePuntoCargaDto,
                ...(codigoNormalizado ? { codigoPuntoc: codigoNormalizado } : {}),
            },
        });
    }

    async remove(id: string) {
        await this.findOne(id); // Valida existencia

        return this.prisma.puntoCargaDescarga.delete({
            where: { idPunto: id },
        });
    }
}