import { IsString, IsOptional, IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateClienteDto {
    @IsString()
    @IsNotEmpty({ message: 'La razón social es obligatoria' })
    @MaxLength(150, { message: 'La razón social no puede exceder los 150 caracteres' })
    razonSocial: string;

    @IsString()
    @IsOptional()
    @MaxLength(150, { message: 'El nombre comercial no puede exceder los 150 caracteres' })
    nombreComercial?: string;

    @IsString()
    @IsNotEmpty({ message: 'El RIF es obligatorio' })
    @MaxLength(30, { message: 'El RIF no puede exceder los 30 caracteres' })
    rif: string;

    @IsString()
    @IsNotEmpty({ message: 'La dirección fiscal es obligatoria' })
    @MaxLength(255, { message: 'La dirección fiscal no puede exceder los 255 caracteres' })
    direccionFiscal: string;

    @IsString()
    @IsNotEmpty({ message: 'El teléfono de contacto es obligatorio' })
    @MaxLength(30, { message: 'El teléfono no puede exceder los 30 caracteres' })
    telefonoContacto: string;

    @IsString()
    @IsNotEmpty({ message: 'La persona de contacto es obligatoria' })
    @MaxLength(255, { message: 'La persona de contacto no puede exceder los 255 caracteres' })
    personaContacto: string;

    @IsEmail({}, { message: 'El formato del correo electrónico de facturación no es válido' })
    @IsNotEmpty({ message: 'El email de facturación es obligatorio' })
    @MaxLength(100, { message: 'El email no puede exceder los 100 caracteres' })
    emailFacturacion: string;
}