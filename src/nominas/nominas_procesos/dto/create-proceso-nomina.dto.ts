export class CreateProcesoNominaDto {
    idCodnomina: string;      // CHAR(2) -> referencia a nominas.id_codnomina
    codProcesonomina: string; // VARCHAR(9) -> código corto único
    fechaInicioP: string;     // DATE -> 'YYYY-MM-DD'
    fechaFinP: string;        // DATE -> 'YYYY-MM-DD'
}
