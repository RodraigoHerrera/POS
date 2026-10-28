import { Prisma } from "@prisma/client";
import { ValidationError } from "./validation";

// Decimal(18,6) en BD: el unitario derivado del total se redondea a 6 decimales.
const DECIMALES_COSTO = 6;

function aDecimalFinito(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? new Prisma.Decimal(num) : null;
}

/**
 * Costo unitario = costo_total / cantidad, redondeado a 6 decimales.
 * Total 0 es legítimo (donaciones/promos) y da 0.
 */
export function costoUnitarioDesdeTotal(total: unknown, cantidad: unknown): number {
  const t = aDecimalFinito(total);
  if (t === null || t.isNegative()) {
    throw new ValidationError("El costo total debe ser un número mayor o igual a 0", "costo_total");
  }
  const c = aDecimalFinito(cantidad);
  if (c === null || c.lte(0)) {
    throw new ValidationError("La cantidad debe ser un número mayor a 0", "cantidad");
  }
  return t.div(c).toDecimalPlaces(DECIMALES_COSTO, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Resuelve el costo unitario a partir de `costo_unit` o `costo_total` (excluyentes).
 * null/undefined cuentan como ausente. Devuelve undefined si no llegó ninguno;
 * cada llamador decide si eso es un error.
 */
export function resolverCostoUnitario(p: {
  costo_unit?: unknown;
  costo_total?: unknown;
  cantidad: unknown;
}): number | undefined {
  const hayUnit = p.costo_unit != null;
  const hayTotal = p.costo_total != null;
  if (hayUnit && hayTotal) {
    throw new ValidationError(
      "Envíe costo_total o costo_unitario, no ambos",
      "costo_total"
    );
  }
  if (hayTotal) return costoUnitarioDesdeTotal(p.costo_total, p.cantidad);
  if (hayUnit) {
    const unit = aDecimalFinito(p.costo_unit);
    if (unit === null || unit.isNegative()) {
      throw new ValidationError(
        "El costo unitario debe ser un número mayor o igual a 0",
        "costo_unit"
      );
    }
    return unit.toNumber();
  }
  return undefined;
}
