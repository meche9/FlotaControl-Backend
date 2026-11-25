import { NominaCalculoEstado } from '@prisma/client';

export class CreateNominaCalculoDto {
    idProcesonomina: string;
    idConductor: string;
    salarioBase?: number;
    totalViajes?: number;
    totalFletes?: number;
    totalAsignaciones?: number;
    totalDeducciones?: number;
    estado?: NominaCalculoEstado;
    fechaPago?: string | Date | null;
    observaciones?: string | null;
}