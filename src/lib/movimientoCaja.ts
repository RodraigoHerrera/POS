// Validación pura de movimientos manuales de efectivo (Entrada / Salida).
// Sin dependencias de prisma/db: la usan tanto el modal (cliente) como la API.
import { ValidationError } from "@/lib/validationError";

export type TipoMovimientoManual = "ENTRADA" | "SALIDA";

export interface MovimientoCajaInput {
  tipo: TipoMovimientoManual;
  monto: number;
  razon: string;
}

/** Valor persistido en `movimientoCaja.tipo` para cada tipo manual. */
export const TIPO_MOVIMIENTO_DB: Record<TipoMovimientoManual, "INGRESO" | "EGRESO"> = {
  ENTRADA: "INGRESO",
  SALIDA: "EGRESO",
};

export const MONTO_MAXIMO_MOVIMIENTO = 1_000_000;
export const RAZON_MIN = 3;
export const RAZON_MAX = 200;

function aCentavos(valor: number): number {
  return Math.round(valor * 100);
}

export function validarMovimientoCaja(input: unknown): MovimientoCajaInput {
  if (typeof input !== "object" || input === null) {
    throw new ValidationError("Datos del movimiento inválidos", "body");
  }
  const { tipo, monto, razon } = input as Record<string, unknown>;

  if (tipo !== "ENTRADA" && tipo !== "SALIDA") {
    throw new ValidationError("El tipo debe ser ENTRADA o SALIDA", "tipo");
  }

  let montoNum: number;
  if (typeof monto === "number") {
    montoNum = monto;
  } else if (typeof monto === "string") {
    const t = monto.trim();
    if (t === "") throw new ValidationError("El monto no puede estar vacío", "monto");
    montoNum = Number(t);
  } else {
    throw new ValidationError("El monto debe ser un número válido mayor a 0", "monto");
  }
  if (!Number.isFinite(montoNum) || montoNum <= 0) {
    throw new ValidationError("El monto debe ser un número mayor a 0", "monto");
  }
  if (montoNum > MONTO_MAXIMO_MOVIMIENTO) {
    throw new ValidationError(
      `El monto no puede superar Bs ${MONTO_MAXIMO_MOVIMIENTO.toLocaleString("en-US")}`,
      "monto"
    );
  }
  if (Math.abs(montoNum * 100 - aCentavos(montoNum)) > 1e-6) {
    throw new ValidationError("El monto admite como máximo 2 decimales", "monto");
  }

  if (typeof razon !== "string") {
    throw new ValidationError("La razón es obligatoria", "razon");
  }
  const razonLimpia = razon.trim();
  if (razonLimpia.length < RAZON_MIN) {
    throw new ValidationError(`La razón debe tener al menos ${RAZON_MIN} caracteres`, "razon");
  }
  if (razonLimpia.length > RAZON_MAX) {
    throw new ValidationError(`La razón no puede superar ${RAZON_MAX} caracteres`, "razon");
  }

  return { tipo, monto: aCentavos(montoNum) / 100, razon: razonLimpia };
}

/** ¿Alcanza el efectivo disponible para retirar `salida`? (aritmética en centavos) */
export function puedeRetirar(salida: number, efectivoDisponible: number): boolean {
  return aCentavos(salida) <= aCentavos(efectivoDisponible);
}
