// Neteo de la necesidad bruta (salida de la explosión) contra stock actual,
// entradas programadas y stock de seguridad, con tope por caducidad para
// insumos perecederos. Política lote por lote (no EOQ): la cantidad sugerida
// es exactamente la necesidad neta, sin redondeo a lote económico.

export interface DatosInsumoNeteo {
  itemId: string;
  necesidadBruta: number;
  stockActual: number;
  entradasProgramadas: number;
  stockMin: number;
  leadTimeDias: number;
  vidaUtilDias: number | null;
  /** MAPE ponderado (0-100) de los productos que consumen este insumo; null si no hay dato confiable. */
  mapeBlendPct: number | null;
  /** necesidadBruta / horizonteDias, usada para la fórmula de seguridad y el tope de caducidad. */
  demandaDiariaInsumo: number;
}

export interface ResultadoNeteo {
  itemId: string;
  necesidadBruta: number;
  stockActual: number;
  entradasProgramadas: number;
  stockSeguridad: number;
  necesidadNeta: number;
  fechaSugeridaEmision: Date;
  topeCaducidadAplicado: boolean;
}

/** Factor de servicio para la fórmula de stock de seguridad. Ajustable. */
const Z_FACTOR = 1.0;

export function calcularStockSeguridad(d: DatosInsumoNeteo): number {
  if (d.mapeBlendPct === null) return d.stockMin;

  const sigma = (d.mapeBlendPct / 100) * d.demandaDiariaInsumo;
  const seguridadPorVariabilidad = Z_FACTOR * sigma * Math.sqrt(Math.max(d.leadTimeDias, 0));
  return Math.max(d.stockMin, seguridadPorVariabilidad);
}

export function calcularNecesidadNeta(
  d: DatosInsumoNeteo,
  horizonteDias: number,
  hoy: Date
): ResultadoNeteo {
  const stockSeguridad = calcularStockSeguridad(d);
  let necesidadNeta = Math.max(
    0,
    d.necesidadBruta - d.stockActual - d.entradasProgramadas + stockSeguridad
  );

  let topeCaducidadAplicado = false;
  if (d.vidaUtilDias !== null && d.vidaUtilDias > 0) {
    const topeConsumible = Math.max(0, d.vidaUtilDias * d.demandaDiariaInsumo - d.stockActual);
    if (necesidadNeta > topeConsumible) {
      necesidadNeta = topeConsumible;
      topeCaducidadAplicado = true;
    }
  }

  const diasHastaEmision = Math.max(0, horizonteDias - d.leadTimeDias);
  const fechaSugeridaEmision = new Date(hoy);
  fechaSugeridaEmision.setDate(fechaSugeridaEmision.getDate() + diasHastaEmision);

  return {
    itemId: d.itemId,
    necesidadBruta: d.necesidadBruta,
    stockActual: d.stockActual,
    entradasProgramadas: d.entradasProgramadas,
    stockSeguridad,
    necesidadNeta,
    fechaSugeridaEmision,
    topeCaducidadAplicado,
  };
}
