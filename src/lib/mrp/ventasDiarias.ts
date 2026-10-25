// Convierte las filas agregadas por SQL (producto, dia local, total) en el mapa
// producto -> dia -> cantidad que consume construirSerieDiaria. Pura.

export interface FilaVentaDiaria {
  producto_id: bigint | number | string;
  /** Dia local YYYY-MM-DD (ya en la zona de negocio). */
  dia: string;
  /** SUM(cantidad): MySQL puede devolver bigint, number, string o Decimal. */
  total: unknown;
}

export function agruparFilasVentas(filas: FilaVentaDiaria[]): Map<string, Map<string, number>> {
  const resultado = new Map<string, Map<string, number>>();
  for (const f of filas) {
    const total = Number(f.total ?? NaN);
    if (!Number.isFinite(total)) continue;
    const key = f.producto_id.toString();
    const porDia = resultado.get(key) ?? new Map<string, number>();
    porDia.set(f.dia, (porDia.get(f.dia) ?? 0) + total);
    resultado.set(key, porDia);
  }
  return resultado;
}
