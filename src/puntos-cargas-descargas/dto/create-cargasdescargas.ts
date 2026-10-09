import { IsString, IsOptional, IsEnum, IsBoolean, IsNotEmpty, MaxLength, IsUUID } from 'class-validator';

export enum TipoPuntoDto {
    Origen = 'Origen',
    Destino = 'Destino',
    Ambos = 'Ambos',
}

export class CreatePuntoCargaDto {
    @IsUUID('4', { message: 'El ID del cliente debe ser un UUID válido' })
    @IsNotEmpty({ message: 'El ID del cliente es obligatorio' })
    idCliente: string;

    @IsString()
    @IsNotEmpty({ message: 'El nombre de la sede es obligatorio' })
    @MaxLength(100, { message: 'El nombre de la sede no puede exceder los 100 caracteres' })
    nombreSede: string;

    @IsEnum(TipoPuntoDto, { message: 'El tipo de punto debe ser Origen, Destino o Ambos' })
    @IsOptional()
    tipoPunto?: TipoPuntoDto;

    @IsString()
    @IsNotEmpty({ message: 'La dirección es obligatoria' })
    @MaxLength(255, { message: 'La dirección no puede exceder los 255 caracteres' })
    direccion: string;

    @IsString()
    @IsNotEmpty({ message: 'La ciudad es obligatoria' })
    @MaxLength(100, { message: 'La ciudad no puede exceder los 100 caracteres' })
    ciudad: string;

    @IsString()
    @IsNotEmpty({ message: 'El estado es obligatorio' })
    @MaxLength(100, { message: 'El estado no puede exceder los 100 caracteres' })
    estado: string;

    @IsString()
    @IsOptional()
    @MaxLength(20, { message: 'El código postal no puede exceder los 20 caracteres' })
    codigoPostal?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100, { message: 'El contacto de almacén no puede exceder los 100 caracteres' })
    contactoAlmacen?: string;

    @IsString()
    @IsOptional()
    @MaxLength(30, { message: 'El teléfono de almacén no puede exceder los 30 caracteres' })
    telefonoAlmacen?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100, { message: 'El horario de atención no puede exceder los 100 caracteres' })
    horarioAtencion?: string;

    @IsString()
    @IsOptional()
    instruccionesAcceso?: string;

    @IsBoolean()
    @IsOptional()
    activo?: boolean;
}