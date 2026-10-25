// Periodo del dashboard: mes calendario o semana (lunes a domingo), hora local.
export type Periodo = "mes" | "semana";

export interface RangoPeriodo {
  inicio: Date;
  fin: Date;
  inicioAnterior: Date;
  finAnterior: Date;
}

export function parsePeriodo(value: string | null | undefined): Periodo {
  return value === "semana" ? "semana" : "mes";
}

function finDeDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function rangoPeriodo(periodo: Periodo, now: Date = new Date()): RangoPeriodo {
  const y = now.getFullYear();
  const m = now.getMonth();

  if (periodo === "semana") {
    // getDay(): 0 = domingo. Desplazamiento desde el lunes: 0..6
    const desdeLunes = (now.getDay() + 6) % 7;
    const inicio = new Date(y, m, now.getDate() - desdeLunes);
    const domingo = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
    const inicioAnterior = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() - 7);
    const domingoAnterior = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() - 1);
    return {
      inicio,
      fin: finDeDia(domingo),
      inicioAnterior,
      finAnterior: finDeDia(domingoAnterior),
    };
  }

  return {
    inicio: new Date(y, m, 1),
    // El día 0 del mes siguiente es el último día del mes actual
    fin: new Date(y, m + 1, 0, 23, 59, 59, 999),
    inicioAnterior: new Date(y, m - 1, 1),
    finAnterior: new Date(y, m, 0, 23, 59, 59, 999),
  };
}
