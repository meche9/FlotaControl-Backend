import { NominaCalculoEstado } from '@prisma/client';

export class UpdateNominaCalculoDto {
    salarioBase?: number;
    totalViajes?: number;
    totalFletes?: number;
    totalAsignaciones?: number;
    totalDeducciones?: number;
    estado?: NominaCalculoEstado;
    fechaPago?: string | Date | null;
    observaciones?: string | null;
}