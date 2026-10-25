// Ventana anti doble-ejecución del MRP: si la última corrida de la sucursal
// se guardó hace menos de VENTANA_CORRIDA_MS, se rechaza una nueva.

export const VENTANA_CORRIDA_MS = 30_000;

export const MENSAJE_CORRIDA_RECIENTE =
  "Ya se ejecutó el MRP para esta sucursal hace unos segundos. Espera un momento antes de volver a ejecutarlo.";

export function corridaReciente(
  ultimaCorridaCreadaEn: Date | null | undefined,
  ahora: Date,
  ventanaMs: number = VENTANA_CORRIDA_MS
): boolean {
  if (!ultimaCorridaCreadaEn) return false;
  return ahora.getTime() - ultimaCorridaCreadaEn.getTime() < ventanaMs;
}
