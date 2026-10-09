import { Injectable, NotFoundException } from '@nestjs/common';
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

        return this.prisma.puntoCargaDescarga.create({
            data: createPuntoCargaDto,
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
        await this.findOne(id); // Valida existencia del punto

        if (updatePuntoCargaDto.idCliente) {
            const clienteExists = await this.prisma.cliente.findUnique({
                where: { idCliente: updatePuntoCargaDto.idCliente },
            });
            if (!clienteExists) {
                throw new NotFoundException(`Cliente con ID ${updatePuntoCargaDto.idCliente} no fue encontrado.`);
            }
        }

        return this.prisma.puntoCargaDescarga.update({
            where: { idPunto: id },
            data: updatePuntoCargaDto,
        });
    }

    async remove(id: string) {
        await this.findOne(id); // Valida existencia

        return this.prisma.puntoCargaDescarga.delete({
            where: { idPunto: id },
        });
    }
}