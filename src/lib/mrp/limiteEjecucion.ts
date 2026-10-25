import type { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, type RateLimitResult } from "@/lib/rate-limit";

// Límite de ejecuciones del MRP por sucursal: cada corrida lee 60 días de
// ventas y explota recetas, así que se frena la ráfaga antes de calcular.
export const LIMITE_EJECUCIONES_MRP = 5;
export const VENTANA_LIMITE_MRP_MS = 60_000;

export function claveLimiteMrp(sucursalId: string): string {
  return `mrp:ejecutar:sucursal:${sucursalId}`;
}

/** Devuelve una respuesta 429 si la sucursal excedió el límite, o null si puede ejecutar. */
export function verificarLimiteMrp(
  sucursalId: string,
  check: (clave: string, limite: number, ventanaMs: number) => RateLimitResult = checkRateLimit
): NextResponse | null {
  const resultado = check(claveLimiteMrp(sucursalId), LIMITE_EJECUCIONES_MRP, VENTANA_LIMITE_MRP_MS);
  if (resultado.allowed) return null;
  return rateLimitResponse(
    resultado.retryAfterSeconds,
    `Demasiadas ejecuciones del MRP. Intenta de nuevo en ${resultado.retryAfterSeconds} segundos.`
  );
}
