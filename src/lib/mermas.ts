import { Prisma } from "@prisma/client";
import {
  ValidationError,
  parsePositiveBigInt,
  parsePositiveNumber,
} from "./validation";
import { compareBigIntAsc, round3Decimals } from "./fefo";

export const TIPOS_MERMA_VALIDOS = ["vencimiento", "dano", "robo", "error"] as const;
export type TipoMerma = (typeof TIPOS_MERMA_VALIDOS)[number];

export interface DatosMermaValidados {
  itemId: bigint;
  cantidad: number;
  tipoMerma: TipoMerma;
  motivo?: string;
  loteReferencia?: string;
}

/**
 * Validates input data fail-fast before database transactions.
 * Throws ValidationError if any field is invalid or missing.
 */
export function validarDatosMerma(body: unknown): DatosMermaValidados {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Cuerpo de solicitud inválido", "body");
  }

  const raw = body as Record<string, unknown>;
  const itemId = parsePositiveBigInt(raw.itemId, "itemId");
  const cantidad = round3Decimals(parsePositiveNumber(raw.cantidad, "cantidad"));

  if (
    typeof raw.tipoMerma !== "string" ||
    !TIPOS_MERMA_VALIDOS.includes(raw.tipoMerma as TipoMerma)
  ) {
    throw new ValidationError(
      `tipoMerma debe ser uno de: ${TIPOS_MERMA_VALIDOS.join(", ")}`,
      "tipoMerma"
    );
  }

  const tipoMerma = raw.tipoMerma as TipoMerma;
  const motivo = typeof raw.motivo === "string" ? raw.motivo : undefined;
  const loteReferencia = typeof raw.loteReferencia === "string" ? raw.loteReferencia : undefined;

  return {
    itemId,
    cantidad,
    tipoMerma,
    motivo,
    loteReferencia,
  };
}

/**
 * Builds standard kardex reference string: tipo + lote + motivo, truncated to 64 chars.
 */
export function construirReferenciaKardexMerma(
  tipoMerma: string,
  loteReferencia?: string,
  motivo?: string
): string {
  const etiquetaTipo: Record<string, string> = {
    vencimiento: "Vencimiento",
    dano: "Daño",
    robo: "Robo",
    error: "Error de registro",
  };

  const partes = [etiquetaTipo[tipoMerma] ?? tipoMerma];
  if (loteReferencia) partes.push(`lote ${loteReferencia}`);
  if (motivo) partes.push(motivo);
  return partes.join(" — ").slice(0, 64);
}

export interface LoteStockParaMerma {
  id: bigint | string | number;
  lote_id: bigint | string | number;
  cantidad: number | string | { toString(): string };
  lote: {
    item_id?: bigint | string | number;
    costo_unit: number | string | { toString(): string };
    fecha_caducidad?: Date | string | null;
  };
}

export interface AllocacionMerma {
  id: bigint;
  lote_id: bigint;
  aDescontar: number;
  costo_unit: number;
}

export interface ResultadoAsignacionMerma {
  allocations: AllocacionMerma[];
  costoTotalPerdido: number;
  stockDisponible: number;
}

/**
 * Allocates lot deductions in memory using FEFO (earliest expiring lot first, tie-break by id ASC),
 * validates overall availability, and returns allocations sorted deterministically by id ASC (INV-1).
 */
export function calcularAsignacionesMermaFEFO(
  lotes: LoteStockParaMerma[],
  cantidadMerma: number
): ResultadoAsignacionMerma {
  const roundedCantidadMerma = round3Decimals(cantidadMerma);

  // Normalizar y ordenar lotes por fecha_caducidad ASC, id ASC
  const lotesOrdenados = lotes.map((l) => {
    let caducidad = Infinity;
    if (l.lote?.fecha_caducidad) {
      const d =
        l.lote.fecha_caducidad instanceof Date
          ? l.lote.fecha_caducidad
          : new Date(l.lote.fecha_caducidad);
      caducidad = isNaN(d.getTime()) ? Infinity : d.getTime();
    }
    return {
      id: BigInt(l.id),
      lote_id: BigInt(l.lote_id),
      cantidad: round3Decimals(Number(l.cantidad)),
      costo_unit: Number(l.lote?.costo_unit ?? 0),
      caducidadTimestamp: caducidad,
    };
  });

  lotesOrdenados.sort((a, b) => {
    if (a.caducidadTimestamp !== b.caducidadTimestamp) {
      return a.caducidadTimestamp < b.caducidadTimestamp ? -1 : 1;
    }
    return compareBigIntAsc(a.id, b.id);
  });

  const stockDisponible = round3Decimals(
    lotesOrdenados.reduce((acc, l) => acc + l.cantidad, 0)
  );

  if (stockDisponible < roundedCantidadMerma) {
    throw new Error(
      `Stock insuficiente: hay ${stockDisponible} disponible y se intenta registrar una merma de ${roundedCantidadMerma}`
    );
  }

  let restante = roundedCantidadMerma;
  let costoTotalPerdido = 0;
  const allocations: AllocacionMerma[] = [];

  for (const lote of lotesOrdenados) {
    if (restante <= 0) break;
    if (lote.cantidad <= 0) continue;

    const aDescontar = round3Decimals(Math.min(lote.cantidad, restante));
    if (aDescontar <= 0) continue;

    allocations.push({
      id: lote.id,
      lote_id: lote.lote_id,
      aDescontar,
      costo_unit: lote.costo_unit,
    });
    costoTotalPerdido += aDescontar * lote.costo_unit;
    restante = round3Decimals(restante - aDescontar);
  }

  if (restante > 0) {
    throw new Error(
      `Stock insuficiente: hay ${stockDisponible} disponible y se intenta registrar una merma de ${roundedCantidadMerma}`
    );
  }

  // INV-1: Ordenar asignaciones determinísticamente por id ASC para prevenir deadlocks
  allocations.sort((a, b) => compareBigIntAsc(a.id, b.id));

  return {
    allocations,
    costoTotalPerdido: Number(costoTotalPerdido.toFixed(4)),
    stockDisponible,
  };
}

export interface ParametrosEjecucionMerma {
  sucursalId: bigint;
  itemId: bigint;
  cantidadMerma: number;
  referencia: string;
  allocations: AllocacionMerma[];
  costoTotalPerdido: number;
}

/**
 * Executes atomic conditional stock decrements on lots (INV-4) and aggregate branch inventory (INV-5),
 * and records Kardex movements.
 */
export async function ejecutarRegistroMermaTx(
  tx: Prisma.TransactionClient | any,
  params: ParametrosEjecucionMerma
): Promise<{ costoTotalPerdido: number; lotesAfectados: number }> {
  const { sucursalId, itemId, cantidadMerma, referencia, allocations, costoTotalPerdido } = params;

  // INV-1: Asegurar orden ascendente de id de lote
  const sortedAllocations = [...allocations].sort((a, b) => compareBigIntAsc(a.id, b.id));

  // INV-4: Decremento atómico condicional en lotes
  for (const alloc of sortedAllocations) {
    const updateResult = await tx.stockLoteSucursal.updateMany({
      where: { id: alloc.id, cantidad: { gte: alloc.aDescontar } },
      data: { cantidad: { decrement: alloc.aDescontar } },
    });
    if (updateResult.count === 0) {
      throw new Error(
        "Stock insuficiente: el lote fue consumido simultáneamente por otra operación, intenta de nuevo"
      );
    }
  }

  // Registrar movimientos en Kardex
  await tx.movimientoInventario.createMany({
    data: sortedAllocations.map((alloc) => ({
      sucursal_id: sucursalId,
      item_id: itemId,
      lote_id: alloc.lote_id,
      tipo: "Salida" as const,
      motivo: "Merma" as const,
      cantidad: alloc.aDescontar,
      costo_unit: alloc.costo_unit,
      referencia,
    })),
  });

  // INV-5: Decremento atómico condicional en inventario de la sucursal
  const invResult = await tx.inventarioSucursal.updateMany({
    where: { sucursal_id: sucursalId, item_id: itemId, stock: { gte: cantidadMerma } },
    data: { stock: { decrement: cantidadMerma } },
  });
  if (invResult.count === 0) {
    throw new Error(
      "Stock insuficiente: el inventario de la sucursal fue consumido simultáneamente por otra operación"
    );
  }

  return {
    costoTotalPerdido,
    lotesAfectados: sortedAllocations.length,
  };
}
