import type { Prisma } from "@prisma/client";
import { ValidationError } from "./validation";
import { round3Decimals } from "./fefo";
import {
  evaluarEditabilidad,
  recalcularCostoPromedioDesdeLotes,
  type EstadoEdicionEntrada,
} from "./entradaEdicion";

const MAX_MOTIVO = 255;

export interface AnulacionEntradaSolicitada {
  motivo: string | null;
}

/**
 * Validates the optional POST body of an entrada void. A missing body or a
 * missing/blank motivo means "no reason given".
 */
export function validarAnulacionEntrada(body: unknown): AnulacionEntradaSolicitada {
  if (body === null || body === undefined) return { motivo: null };
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("El cuerpo de la solicitud es inválido");
  }
  const { motivo } = body as Record<string, unknown>;
  if (motivo === undefined || motivo === null) return { motivo: null };
  if (typeof motivo !== "string") {
    throw new ValidationError("El motivo debe ser texto", "motivo");
  }
  const texto = motivo.trim();
  if (texto.length > MAX_MOTIVO) {
    throw new ValidationError(`El motivo no puede superar ${MAX_MOTIVO} caracteres`, "motivo");
  }
  return { motivo: texto === "" ? null : texto };
}

export type CodigoErrorAnulacion =
  | "ENTRADA_NO_ENCONTRADA"
  | "ENTRADA_YA_ANULADA"
  | "ENTRADA_NO_ANULABLE";

export type Anulabilidad =
  | { anulable: true }
  | { anulable: false; codigo: CodigoErrorAnulacion };

/**
 * Shared by the POST executor (authoritative, under lock) and the kardex
 * listing (advisory flags). A null state means the movement does not exist.
 * An entry is voidable when it is an untouched manual entry (same rule as
 * quantity/cost editability) that has not been voided yet.
 */
export function evaluarAnulabilidad(e: EstadoEdicionEntrada | null): Anulabilidad {
  if (!e) return { anulable: false, codigo: "ENTRADA_NO_ENCONTRADA" };

  const base = evaluarEditabilidad({ ...e, anulado: false });
  if (!base.editable) return { anulable: false, codigo: "ENTRADA_NO_ANULABLE" };
  if (e.anulado) return { anulable: false, codigo: "ENTRADA_YA_ANULADA" };
  if (!base.cantidadCostoEditables) return { anulable: false, codigo: "ENTRADA_NO_ANULABLE" };
  return { anulable: true };
}

// Messages must never contain "deadlock", "1213" or "1205" (isDeadlockError
// matches on substrings) nor start with "Stock insuficiente".
const ERRORES_ANULACION: Record<CodigoErrorAnulacion, { status: 404 | 409; message: string }> = {
  ENTRADA_NO_ENCONTRADA: { status: 404, message: "Entrada no encontrada" },
  ENTRADA_YA_ANULADA: { status: 409, message: "Esta entrada ya fue anulada" },
  ENTRADA_NO_ANULABLE: {
    status: 409,
    message: "Solo se puede anular una entrada manual cuyo lote no tenga otros movimientos",
  },
};

export class AnulacionEntradaError extends Error {
  readonly codigo: CodigoErrorAnulacion;
  readonly status: 404 | 409;

  constructor(codigo: CodigoErrorAnulacion) {
    super(ERRORES_ANULACION[codigo].message);
    this.name = "AnulacionEntradaError";
    this.codigo = codigo;
    this.status = ERRORES_ANULACION[codigo].status;
    Object.setPrototypeOf(this, AnulacionEntradaError.prototype);
  }
}

export interface RespuestaErrorAnulacion {
  status: number;
  body: Record<string, string>;
}

/** Pure translation of any error thrown by the void flow into an HTTP status and body. */
export function mapearErrorAnulacion(error: unknown): RespuestaErrorAnulacion {
  if (error instanceof AnulacionEntradaError) {
    return { status: error.status, body: { message: error.message } };
  }
  if (error instanceof ValidationError) {
    return { status: 400, body: { error: error.message, message: error.message } };
  }
  return { status: 500, body: { error: "Error al anular la entrada" } };
}

export interface ParametrosAnulacionEntrada {
  movimientoId: bigint;
  sucursalId: bigint;
  empleadoId: bigint;
  motivo: string | null;
}

export interface ResultadoAnulacionEntrada {
  inventario: { stock: number; costo_promedio: number };
}

const aNumero = (v: unknown): number =>
  Number((v as { toString(): string } | null)?.toString() ?? v ?? 0);

interface MovimientoAnulable {
  id: bigint;
  sucursal_id: bigint;
  item_id: bigint;
  lote_id: bigint | null;
  tipo: string;
  motivo: string;
  cantidad: unknown;
  anulado_en?: Date | null;
}

/**
 * Atomic void of a manual entrada. Must run inside runWithRetry.
 * Phase A: FOR UPDATE locks in the same order as the edit flow (movimiento,
 * lote, stockLoteSucursal, inventarioSucursal).
 * Phase B: plain consistent reads, only after the last lock, then the
 * authoritative eligibility check.
 * Phase C: writes and the audit row. No Prisma write happens before Phase B
 * ends, because Prisma update calls issue their own SELECTs.
 */
export async function ejecutarAnulacionEntradaTx(
  tx: Prisma.TransactionClient,
  p: ParametrosAnulacionEntrada
): Promise<ResultadoAnulacionEntrada> {
  // Phase A
  const movs = await tx.$queryRaw<MovimientoAnulable[]>`SELECT id, sucursal_id, item_id, lote_id, tipo, motivo, cantidad, anulado_en FROM \`movimientoInventario\` WHERE id = ${p.movimientoId} FOR UPDATE`;
  const mov = movs?.[0];
  if (!mov || BigInt(mov.sucursal_id) !== p.sucursalId) {
    throw new AnulacionEntradaError("ENTRADA_NO_ENCONTRADA");
  }
  const cantidad = aNumero(mov.cantidad);
  const movimientoId = BigInt(mov.id);
  const anulado = mov.anulado_en != null;

  // Facts only known after the locks (Phase B) are stubbed optimistically: this
  // only rejects movements that can never be voidable, before locking the lote.
  const previa = evaluarAnulabilidad({
    tipo: mov.tipo,
    motivo: mov.motivo,
    loteId: mov.lote_id,
    movimientoId,
    cantidadMovimiento: cantidad,
    primerMovimientoLoteId: movimientoId,
    totalMovimientosLote: 1,
    consumosProduccionLote: 0,
    cantidadStockLote: cantidad,
    anulado,
  });
  if (!previa.anulable || mov.lote_id === null) {
    throw new AnulacionEntradaError(previa.anulable ? "ENTRADA_NO_ANULABLE" : previa.codigo);
  }
  const loteId = BigInt(mov.lote_id);

  const lotes = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM \`lote\` WHERE id = ${loteId} FOR UPDATE`;
  if (!lotes?.[0]) throw new AnulacionEntradaError("ENTRADA_NO_ENCONTRADA");

  const stocks = await tx.$queryRaw<Array<{ id: bigint; cantidad: unknown }>>`SELECT id, cantidad FROM \`stockLoteSucursal\` WHERE sucursal_id = ${p.sucursalId} AND lote_id = ${loteId} FOR UPDATE`;
  const inventarios = await tx.$queryRaw<
    Array<{ id: bigint; stock: unknown; costo_promedio: unknown }>
  >`SELECT id, stock, costo_promedio FROM \`inventarioSucursal\` WHERE sucursal_id = ${p.sucursalId} AND item_id = ${mov.item_id} FOR UPDATE`;
  if (!inventarios?.[0]) throw new Error("INVENTARIO_SUCURSAL_NOT_FOUND");
  const stockLote = stocks?.[0] ?? null;
  const inventario = inventarios[0];

  // Phase B: every plain read happens after the last lock.
  const agregado = await tx.movimientoInventario.aggregate({
    where: { lote_id: loteId },
    _min: { id: true },
    _count: { _all: true },
  });
  const consumos: number = await tx.produccionItem.count({ where: { lote_consumido_id: loteId } });

  const estado = evaluarAnulabilidad({
    tipo: mov.tipo,
    motivo: mov.motivo,
    loteId,
    movimientoId,
    cantidadMovimiento: cantidad,
    primerMovimientoLoteId: agregado._min.id ?? null,
    totalMovimientosLote: agregado._count._all,
    consumosProduccionLote: consumos,
    cantidadStockLote: stockLote ? aNumero(stockLote.cantidad) : null,
    anulado,
  });
  if (!estado.anulable) throw new AnulacionEntradaError(estado.codigo);

  const stockActual = aNumero(inventario.stock);
  const nuevoStock = round3Decimals(stockActual - cantidad);
  if (nuevoStock < 0) throw new AnulacionEntradaError("ENTRADA_NO_ANULABLE");

  const lotesItem: Array<{ lote_id: bigint; cantidad: unknown; lote: { costo_unit: unknown } }> =
    await tx.stockLoteSucursal.findMany({
      where: { sucursal_id: p.sucursalId, lote: { item_id: mov.item_id }, cantidad: { gt: 0 } },
      select: { lote_id: true, cantidad: true, lote: { select: { costo_unit: true } } },
    });
  // The voided lote contributes nothing; with no stock left the previous
  // average cost is kept (same fallback as the edit flow).
  const resultado = {
    stock: nuevoStock,
    costo_promedio: recalcularCostoPromedioDesdeLotes(
      lotesItem.map((l) => ({
        lote_id: BigInt(l.lote_id),
        cantidad: aNumero(l.cantidad),
        costo_unit: aNumero(l.lote.costo_unit),
      })),
      { lote_id: loteId, cantidad: 0, costo_unit: aNumero(inventario.costo_promedio) }
    ),
  };

  // Phase C: writes.
  await tx.stockLoteSucursal.update({ where: { id: stockLote!.id }, data: { cantidad: 0 } });
  await tx.inventarioSucursal.update({ where: { id: inventario.id }, data: resultado });
  await tx.movimientoInventario.update({
    where: { id: p.movimientoId },
    data: { anulado_en: new Date() },
  });
  await tx.auditoriaEntrada.createMany({
    data: [
      {
        movimiento_id: p.movimientoId,
        lote_id: loteId,
        sucursal_id: p.sucursalId,
        empleado_id: p.empleadoId,
        campo: "anulacion",
        valor_anterior: cantidad.toFixed(3),
        valor_nuevo: p.motivo,
      },
    ],
  });

  return { inventario: resultado };
}
