export class CalcularDetalleNominaDto {
    idProcesonomina: string;
    idConductor?: string;
    porcentajeViaje?: number;          // Ej. 0.15 = 15% del montoFleteCliente (por defecto 0.15)
    salarioBase?: number;             // Base fija opcional si se desea asignar/actualizar
    descontarAnticipo?: boolean;      // Descuenta montoAnticipoConductor en deducciones (por defecto true)
    descontarGasoil?: boolean;        // Descuenta montoGasoil en deducciones (por defecto false)
    marcarRecargosProcesados?: boolean; // Pasa recargos 'Pendiente' a 'Procesado' (por defecto true)
}