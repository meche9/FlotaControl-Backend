import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateClienteDto } from './dto/create-cliente.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ClientesService {
    constructor(private readonly prisma: PrismaService) { }

    private manejarErrorPrisma(error: unknown, rif?: string): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const rifMsg = rif ? ` '${rif}'` : '';
            throw new ConflictException(`Ya existe un cliente registrado con el RIF${rifMsg}.`);
        }
        throw error;
    }

    async create(createClienteDto: CreateClienteDto) {
        try {
            return await this.prisma.cliente.create({
                data: createClienteDto,
                include: {
                    _count: {
                        select: {
                            puntosCargaDescarga: true,
                            guiasViajes: true,
                            proformas: true,
                        },
                    },
                    puntosCargaDescarga: true,
                },
            });
        } catch (error) {
            this.manejarErrorPrisma(error, createClienteDto.rif);
        }
    }

    async findAll() {
        return this.prisma.cliente.findMany({
            orderBy: { fechaCreacion: 'desc' },
            include: {
                _count: {
                    select: {
                        puntosCargaDescarga: true,
                        guiasViajes: true,
                        proformas: true,
                    },
                },
                puntosCargaDescarga: {
                    select: {
                        idPunto: true,
                        nombreSede: true,
                        ciudad: true,
                        estado: true,
                        tipoPunto: true,
                        activo: true,
                    },
                },
            },
        });
    }

    async findOne(id: string) {
        const cliente = await this.prisma.cliente.findUnique({
            where: { idCliente: id },
            include: {
                _count: {
                    select: {
                        puntosCargaDescarga: true,
                        guiasViajes: true,
                        proformas: true,
                    },
                },
                puntosCargaDescarga: true,
                guiasViajes: {
                    take: 5,
                    orderBy: { fechaCreacion: 'desc' },
                },
                proformas: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!cliente) {
            throw new NotFoundException(`Cliente con ID ${id} no fue encontrado.`);
        }

        return cliente;
    }

    async update(id: string, updateClienteDto: UpdateClienteDto) {
        // Valida si existe antes de actualizar
        await this.findOne(id);

        try {
            return await this.prisma.cliente.update({
                where: { idCliente: id },
                data: updateClienteDto,
                include: {
                    _count: {
                        select: {
                            puntosCargaDescarga: true,
                            guiasViajes: true,
                            proformas: true,
                        },
                    },
                    puntosCargaDescarga: true,
                },
            });
        } catch (error) {
            this.manejarErrorPrisma(error, updateClienteDto.rif);
        }
    }

    async remove(id: string) {
        // Valida si existe antes de eliminar
        await this.findOne(id);

        return this.prisma.cliente.delete({
            where: { idCliente: id },
        });
    }
}