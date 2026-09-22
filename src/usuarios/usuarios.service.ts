import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuarios.dto.js';
import { UpdateUsuarioDto } from '../usuarios/dto/update-usuarios.dto.js';

@Injectable()
export class UsuariosService {
    constructor(private readonly prisma: PrismaService) { }



    //Crear un Usuario
    async create(createUsuarioDto: CreateUsuarioDto) {
        return await this.prisma.usuario.create({
            data: createUsuarioDto,
        });
    }

    //Buscar todos los usuarios
    async findAll() {
        return await this.prisma.usuario.findMany({
            include: {
                rol: true,
            },
        });
    }


    //Buscar usuario por email
    async findOneByEmail(email: string) {
        const usuario = await this.prisma.usuario.findUnique({
            where: { email },
        });
        if (!usuario) {
            throw new NotFoundException(`No se encontró ningún Usuario con  ese email ${email}`);
        }
        return usuario;
    }

    //Buscar usuario por id
    async findOne(id: number) {
        const usuario = await this.prisma.usuario.findUnique({
            where: { id: id },
            include: {
                rol: true,
            },
        });

        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }

        return usuario;
    }


    //Actualizar datos de un Usuario
    async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
        // 1. Verificamos si el Usuario existe (lanza error 404 si no)
        await this.findOne(id);

        // 2. Actualizamos en la base de datos
        return await this.prisma.usuario.update({
            where: { id: id },
            data: updateUsuarioDto,
        });
    }


}