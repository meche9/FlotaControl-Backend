import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuarios.dto.js';
import { UpdateUsuarioDto } from '../usuarios/dto/update-usuarios.dto.js';

// Campos que nunca deben salir de la API (OWASP A02)
const CAMPOS_SENSIBLES = { passwordHash: true, tokenVersion: true } as const;

@Injectable()
export class UsuariosService {
    private readonly bcryptRounds: number;

    constructor(
        private readonly prisma: PrismaService,
        config: ConfigService,
    ) {
        this.bcryptRounds = config.get<number>('BCRYPT_ROUNDS') ?? 12;
    }



    //Crear un Usuario
    async create(createUsuarioDto: CreateUsuarioDto) {
        const { password, ...datos } = createUsuarioDto;
        const passwordHash = await bcrypt.hash(password, this.bcryptRounds);

        try {
            return await this.prisma.usuario.create({
                data: { ...datos, passwordHash },
                omit: CAMPOS_SENSIBLES,
                include: { rol: true },
            });
        } catch (error) {
            this.manejarErrorPrisma(error);
        }
    }

    //Buscar todos los usuarios
    async findAll() {
        return await this.prisma.usuario.findMany({
            omit: CAMPOS_SENSIBLES,
            include: {
                rol: true,
            },
        });
    }


    //Buscar usuario por email
    async findOneByEmail(email: string) {
        const usuario = await this.prisma.usuario.findUnique({
            where: { email: email.trim().toLowerCase() },
            omit: CAMPOS_SENSIBLES,
            include: { rol: true },
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
            omit: CAMPOS_SENSIBLES,
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

        const { password, ...datos } = updateUsuarioDto;
        const data: Prisma.UsuarioUncheckedUpdateInput = { ...datos };

        // Cambio de contraseña: se hashea e invalida cualquier access token emitido
        if (password) {
            data.passwordHash = await bcrypt.hash(password, this.bcryptRounds);
            data.tokenVersion = { increment: 1 };
        }

        const cierraSesiones = Boolean(password) || (datos.estado !== undefined && datos.estado !== 'activo');

        // 2. Actualizamos en la base de datos
        try {
            return await this.prisma.$transaction(async (tx) => {
                const usuario = await tx.usuario.update({
                    where: { id: id },
                    data,
                    omit: CAMPOS_SENSIBLES,
                    include: { rol: true },
                });

                if (cierraSesiones) {
                    await tx.refreshToken.updateMany({
                        where: { usuarioId: id, revocadoEn: null },
                        data: { revocadoEn: new Date() },
                    });
                }

                return usuario;
            });
        } catch (error) {
            this.manejarErrorPrisma(error);
        }
    }

    private manejarErrorPrisma(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                throw new ConflictException('Ya existe un usuario registrado con ese email');
            }
            if (error.code === 'P2003') {
                throw new BadRequestException('El rol indicado no existe');
            }
        }
        throw error;
    }
}
