import type { PrismaClient } from "@prisma/client";
import {
  evaluarEditabilidad,
  MOTIVOS_ENTRADA_EDITABLES,
  type Editabilidad,
} from "./entradaEdicion";
import { evaluarAnulabilidad } from "./entradaAnulacion";

export interface EstadoLoteKardex {
  primerMovimientoId: bigint | null;
  totalMovimientos: number;
  consumosProduccion: number;
  /** Quantity of stockLoteSucursal for the sucursal; null when no row exists. */
  cantidadStock: number | null;
}

export interface FilaKardexEditable {
  id: bigint;
  tipo: string;
  motivo: string;
  loteId: bigint | null;
  cantidad: number;
  /** The movement was voided (anulado_en is set). */
  anulado?: boolean;
}

export interface FlagsKardex extends Editabilidad {
  anulado: boolean;
  /** The entry can be voided (untouched manual entry that is not voided yet). */
  anulable: boolean;
}

export type MapaEstadoLotes = Map<string, EstadoLoteKardex>;

/** Ids of the lots worth evaluating (Entrada with an editable motivo and a lote). */
export function lotesCandidatos(
  filas: ReadonlyArray<Pick<FilaKardexEditable, "tipo" | "motivo" | "loteId">>
): bigint[] {
  const ids = new Map<string, bigint>();
  for (const f of filas) {
    if (
      f.tipo === "Entrada" &&
      f.loteId !== null &&
      (MOTIVOS_ENTRADA_EDITABLES as readonly string[]).includes(f.motivo)
    ) {
      ids.set(f.loteId.toString(), f.loteId);
    }
  }
  return [...ids.values()];
}

/**
 * Loads the editability state of many lots with 3 batched queries,
 * regardless of the number of lots (no per-row queries).
 */
export async function cargarEstadoEdicionLotes(
  prisma: Pick<PrismaClient, "movimientoInventario" | "stockLoteSucursal" | "produccionItem">,
  sucursalId: bigint,
  loteIds: bigint[]
): Promise<MapaEstadoLotes> {
  const mapa: MapaEstadoLotes = new Map();
  if (loteIds.length === 0) return mapa;

  const [movimientos, stocks, consumos] = await Promise.all([
    prisma.movimientoInventario.groupBy({
      by: ["lote_id"],
      where: { lote_id: { in: loteIds } },
      _min: { id: true },
      _count: { _all: true },
    }),
    prisma.stockLoteSucursal.findMany({
      where: { sucursal_id: sucursalId, lote_id: { in: loteIds } },
      select: { lote_id: true, cantidad: true },
    }),
    prisma.produccionItem.groupBy({
      by: ["lote_consumido_id"],
      where: { lote_consumido_id: { in: loteIds } },
      _count: { _all: true },
    }),
  ]);

  const movPorLote = new Map(
    movimientos.map((m) => [String(m.lote_id), m] as const)
  );
  const stockPorLote = new Map(
    stocks.map((s) => [s.lote_id.toString(), Number(s.cantidad)] as const)
  );
  const consumoPorLote = new Map(
    consumos.map((c) => [String(c.lote_consumido_id), c._count._all] as const)
  );

  for (const id of loteIds) {
    const k = id.toString();
    const mov = movPorLote.get(k);
    mapa.set(k, {
      primerMovimientoId: mov?._min.id ?? null,
      totalMovimientos: mov?._count._all ?? 0,
      consumosProduccion: consumoPorLote.get(k) ?? 0,
      cantidadStock: stockPorLote.get(k) ?? null,
    });
  }
  return mapa;
}

export function calcularFlagsKardex(
  fila: FilaKardexEditable,
  estado: EstadoLoteKardex | undefined
): FlagsKardex {
  const anulado = fila.anulado === true;
  if (!estado) {
    return { editable: false, cantidadCostoEditables: false, anulado, anulable: false };
  }
  const entrada = {
    tipo: fila.tipo,
    motivo: fila.motivo,
    loteId: fila.loteId,
    movimientoId: fila.id,
    cantidadMovimiento: fila.cantidad,
    primerMovimientoLoteId: estado.primerMovimientoId,
    totalMovimientosLote: estado.totalMovimientos,
    consumosProduccionLote: estado.consumosProduccion,
    cantidadStockLote: estado.cantidadStock,
    anulado,
  };
  return {
    ...evaluarEditabilidad(entrada),
    anulado,
    anulable: evaluarAnulabilidad(entrada).anulable,
  };
}
