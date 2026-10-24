import { Prisma } from "@prisma/client";
import { ValidationError, parseNonNegativeNumber, parsePositiveNumber } from "./validation";
import { round3Decimals } from "./fefo";
import { round6Decimals } from "./inventario";

export const MOTIVOS_ENTRADA_EDITABLES = ["Compra", "Ajuste", "Traslado"] as const;
export const CAMPOS_AUDITABLES = [
  "codigo_lote",
  "fecha_caducidad",
  "referencia",
  "cantidad",
  "costo_unit",
] as const;
export type CampoAuditable = (typeof CAMPOS_AUDITABLES)[number];

const CLAVES_INMUTABLES = [
  "item",
  "item_id",
  "motivo",
  "proveedor",
  "proveedor_id",
  "sucursal_id",
  "tipo",
  "lote_id",
] as const;
const MAX_LONGITUD = 64;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export interface EdicionEntradaSolicitada {
  codigo_lote?: string;
  fecha_caducidad?: string | null;
  referencia?: string | null;
  cantidad?: number;
  costo_unit?: number;
}

function parseTexto(value: unknown, campo: string): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${campo} debe ser texto`, campo);
  }
  const texto = value.trim();
  if (texto.length > MAX_LONGITUD) {
    throw new ValidationError(`${campo} no puede superar ${MAX_LONGITUD} caracteres`, campo);
  }
  return texto;
}

function parseFechaCaducidad(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ValidationError("Fecha de caducidad inválida", "fecha_caducidad");
  }
  const texto = value.trim();
  if (texto === "") return null;
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  if (
    !FORMATO_FECHA.test(texto) ||
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== texto
  ) {
    throw new ValidationError("Fecha de caducidad inválida (use AAAA-MM-DD)", "fecha_caducidad");
  }
  return texto;
}

/**
 * Validates the PATCH body of an entrada edit. Absent keys mean "unchanged".
 * Throws ValidationError for immutable keys, invalid values or an empty edit.
 */
export function validarEdicionEntrada(body: unknown): EdicionEntradaSolicitada {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("El cuerpo de la solicitud es inválido");
  }
  const datos = body as Record<string, unknown>;

  for (const clave of CLAVES_INMUTABLES) {
    if (clave in datos) {
      throw new ValidationError(`El campo ${clave} no se puede modificar`, clave);
    }
  }

  const resultado: EdicionEntradaSolicitada = {};

  if ("codigo_lote" in datos) {
    const codigo = parseTexto(datos.codigo_lote, "codigo_lote");
    if (codigo === "") {
      throw new ValidationError("El código de lote no puede estar vacío", "codigo_lote");
    }
    resultado.codigo_lote = codigo;
  }
  if ("fecha_caducidad" in datos) {
    resultado.fecha_caducidad = parseFechaCaducidad(datos.fecha_caducidad);
  }
  if ("referencia" in datos) {
    resultado.referencia =
      datos.referencia === null ? null : parseTexto(datos.referencia, "referencia") || null;
  }
  if ("cantidad" in datos) {
    resultado.cantidad = parsePositiveNumber(datos.cantidad, "Cantidad");
  }
  if ("costo_unit" in datos) {
    resultado.costo_unit = parseNonNegativeNumber(datos.costo_unit, "Costo unitario");
  }

  if (Object.keys(resultado).length === 0) {
    throw new ValidationError("No se indicó ningún campo para editar");
  }
  return resultado;
}

export interface EstadoEdicionEntrada {
  tipo: string;
  motivo: string;
  loteId: bigint | null;
  movimientoId: bigint;
  cantidadMovimiento: number;
  /** Lowest movimientoInventario id referencing the lote (the originating movement). */
  primerMovimientoLoteId: bigint | null;
  totalMovimientosLote: number;
  consumosProduccionLote: number;
  /** Quantity of stockLoteSucursal for this sucursal; null when the row does not exist. */
  cantidadStockLote: number | null;
}

export interface Editabilidad {
  /** Metadata (codigo_lote, fecha_caducidad, referencia) can be edited. */
  editable: boolean;
  /** Quantity and unit cost can also be edited (the lote is untouched). */
  cantidadCostoEditables: boolean;
}

/**
 * Shared by the PATCH executor (authoritative, under lock) and the kardex
 * listing (advisory flags).
 */
export function evaluarEditabilidad(e: EstadoEdicionEntrada): Editabilidad {
  const editable =
    e.tipo === "Entrada" &&
    e.loteId !== null &&
    (MOTIVOS_ENTRADA_EDITABLES as readonly string[]).includes(e.motivo) &&
    e.primerMovimientoLoteId === e.movimientoId;
  if (!editable) {
    return { editable: false, cantidadCostoEditables: false };
  }

  const sinTocar =
    e.totalMovimientosLote === 1 &&
    e.consumosProduccionLote === 0 &&
    e.cantidadStockLote !== null &&
    round3Decimals(e.cantidadStockLote) === round3Decimals(e.cantidadMovimiento);
  return { editable: true, cantidadCostoEditables: sinTocar };
}

export interface ValoresEntrada {
  codigo_lote: string;
  fecha_caducidad: Date | null;
  referencia: string | null;
  cantidad: number;
  costo_unit: number;
}

export interface CambioEntrada {
  campo: CampoAuditable;
  anterior: string | null;
  nuevo: string | null;
}

const normalizarCantidad = (v: number): string => v.toFixed(3);
const normalizarCosto = (v: number): string => v.toFixed(6);
const normalizarFecha = (v: Date | string | null): string | null =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v;

/**
 * Compares the requested edit against the current values using normalized
 * strings and returns only the fields that really change, in
 * CAMPOS_AUDITABLES order.
 */
export function calcularCambiosEntrada(
  actual: ValoresEntrada,
  solicitud: EdicionEntradaSolicitada
): CambioEntrada[] {
  const anteriores: Record<CampoAuditable, string | null> = {
    codigo_lote: actual.codigo_lote,
    fecha_caducidad: normalizarFecha(actual.fecha_caducidad),
    referencia: actual.referencia,
    cantidad: normalizarCantidad(actual.cantidad),
    costo_unit: normalizarCosto(actual.costo_unit),
  };
  const nuevos: Partial<Record<CampoAuditable, string | null>> = {};
  if (solicitud.codigo_lote !== undefined) nuevos.codigo_lote = solicitud.codigo_lote;
  if (solicitud.fecha_caducidad !== undefined) nuevos.fecha_caducidad = solicitud.fecha_caducidad;
  if (solicitud.referencia !== undefined) nuevos.referencia = solicitud.referencia;
  if (solicitud.cantidad !== undefined) nuevos.cantidad = normalizarCantidad(solicitud.cantidad);
  if (solicitud.costo_unit !== undefined) nuevos.costo_unit = normalizarCosto(solicitud.costo_unit);

  return CAMPOS_AUDITABLES.filter(
    (campo) => campo in nuevos && nuevos[campo] !== anteriores[campo]
  ).map((campo) => ({
    campo,
    anterior: anteriores[campo],
    nuevo: nuevos[campo] ?? null,
  }));
}

export interface LoteValorizado {
  lote_id: bigint;
  cantidad: number;
  costo_unit: number;
}

/**
 * Weighted average cost of an item from its lots, with the edited lote
 * replaced (or appended) by its post-edit values.
 * Falls back to the replacement cost when the total quantity is not positive.
 */
export function recalcularCostoPromedioDesdeLotes(
  lotes: LoteValorizado[],
  reemplazo: LoteValorizado
): number {
  const resultantes = [
    ...lotes.filter((l) => l.lote_id !== reemplazo.lote_id),
    reemplazo,
  ].filter((l) => l.cantidad > 0);

  const cantidadTotal = resultantes.reduce((acc, l) => acc + l.cantidad, 0);
  if (cantidadTotal <= 0) return round6Decimals(reemplazo.costo_unit);

  const valorTotal = resultantes.reduce((acc, l) => acc + l.cantidad * l.costo_unit, 0);
  const promedio = valorTotal / cantidadTotal;
  return Number.isFinite(promedio) ? round6Decimals(promedio) : round6Decimals(reemplazo.costo_unit);
}

export function construirRegistrosAuditoria(
  cambios: CambioEntrada[],
  ctx: { movimientoId: bigint; loteId: bigint; sucursalId: bigint; empleadoId: bigint }
): Prisma.auditoriaEntradaCreateManyInput[] {
  return cambios.map((cambio) => ({
    movimiento_id: ctx.movimientoId,
    lote_id: ctx.loteId,
    sucursal_id: ctx.sucursalId,
    empleado_id: ctx.empleadoId,
    campo: cambio.campo,
    valor_anterior: cambio.anterior,
    valor_nuevo: cambio.nuevo,
  }));
}

export type CodigoErrorEdicion =
  | "ENTRADA_NO_ENCONTRADA"
  | "ENTRADA_NO_EDITABLE"
  | "CANTIDAD_COSTO_NO_EDITABLES";

// Messages must never contain "deadlock", "1213" or "1205" (isDeadlockError
// matches on substrings) nor start with "Stock insuficiente".
const ERRORES_EDICION: Record<CodigoErrorEdicion, { status: 404 | 409; message: string }> = {
  ENTRADA_NO_ENCONTRADA: { status: 404, message: "Entrada no encontrada" },
  ENTRADA_NO_EDITABLE: { status: 409, message: "Este movimiento no es una entrada editable" },
  CANTIDAD_COSTO_NO_EDITABLES: {
    status: 409,
    message:
      "El lote ya tuvo movimientos: solo se pueden editar código de lote, vencimiento y referencia",
  },
};

export class EdicionEntradaError extends Error {
  readonly codigo: CodigoErrorEdicion;
  readonly status: 404 | 409;

  constructor(codigo: CodigoErrorEdicion) {
    super(ERRORES_EDICION[codigo].message);
    this.name = "EdicionEntradaError";
    this.codigo = codigo;
    this.status = ERRORES_EDICION[codigo].status;
    Object.setPrototypeOf(this, EdicionEntradaError.prototype);
  }
}

export interface RespuestaErrorEdicion {
  status: number;
  body: Record<string, string>;
}

/** Pure translation of any error thrown by the edit flow into an HTTP status and body. */
export function mapearErrorEdicion(error: unknown): RespuestaErrorEdicion {
  if (error instanceof EdicionEntradaError) {
    return { status: error.status, body: { message: error.message } };
  }
  if (error instanceof ValidationError) {
    return { status: 400, body: { error: error.message, message: error.message } };
  }
  const prismaError = error as { code?: unknown; meta?: { target?: unknown } } | null;
  if (
    typeof prismaError === "object" &&
    prismaError !== null &&
    prismaError.code === "P2002" &&
    String(prismaError.meta?.target ?? "").includes("codigo_lote")
  ) {
    return {
      status: 409,
      body: { message: "Ya existe un lote con ese código para este item" },
    };
  }
  return { status: 500, body: { error: "Error al editar la entrada" } };
}

export interface ParametrosEdicionEntrada {
  movimientoId: bigint;
  sucursalId: bigint;
  empleadoId: bigint;
  solicitud: EdicionEntradaSolicitada;
}

export type ResultadoEdicionEntrada =
  | { sinCambios: true }
  | {
      sinCambios: false;
      cambios: CambioEntrada[];
      inventario?: { stock: number; costo_promedio: number };
    };

const aNumero = (v: unknown): number =>
  Number((v as { toString(): string } | null)?.toString() ?? v ?? 0);

interface MovimientoBloqueado {
  id: bigint;
  sucursal_id: bigint;
  item_id: bigint;
  lote_id: bigint | null;
  tipo: string;
  motivo: string;
  cantidad: unknown;
  costo_unit: unknown;
  referencia: string | null;
}

interface LoteBloqueado {
  id: bigint;
  codigo_lote: string;
  fecha_caducidad: Date | null;
  costo_unit: unknown;
}

/**
 * Phase A, steps 1-2: FOR UPDATE locks on the movement and its lote.
 * The movement must exist in the session sucursal and be a plausible entrada.
 */
async function bloquearMovimientoYLote(
  tx: Prisma.TransactionClient,
  p: ParametrosEdicionEntrada
): Promise<{ mov: MovimientoBloqueado; lote: LoteBloqueado }> {
  const movs = await tx.$queryRaw<MovimientoBloqueado[]>`SELECT id, sucursal_id, item_id, lote_id, tipo, motivo, cantidad, costo_unit, referencia FROM \`movimientoInventario\` WHERE id = ${p.movimientoId} FOR UPDATE`;
  const mov = movs?.[0];
  if (!mov || BigInt(mov.sucursal_id) !== p.sucursalId) {
    throw new EdicionEntradaError("ENTRADA_NO_ENCONTRADA");
  }

  // Facts only known after the locks (Phase B) are stubbed optimistically: this
  // only rejects movements that can never be editable, before locking the lote.
  const previa = evaluarEditabilidad({
    tipo: mov.tipo,
    motivo: mov.motivo,
    loteId: mov.lote_id,
    movimientoId: BigInt(mov.id),
    cantidadMovimiento: aNumero(mov.cantidad),
    primerMovimientoLoteId: BigInt(mov.id),
    totalMovimientosLote: 1,
    consumosProduccionLote: 0,
    cantidadStockLote: aNumero(mov.cantidad),
  });
  if (!previa.editable || mov.lote_id === null) {
    throw new EdicionEntradaError("ENTRADA_NO_EDITABLE");
  }

  const lotes = await tx.$queryRaw<LoteBloqueado[]>`SELECT id, item_id, codigo_lote, fecha_caducidad, costo_unit FROM \`lote\` WHERE id = ${mov.lote_id} FOR UPDATE`;
  if (!lotes?.[0]) throw new EdicionEntradaError("ENTRADA_NO_ENCONTRADA");
  return { mov, lote: lotes[0] };
}

/** Phase A, steps 3-4 (only when quantity/cost change): stockLote, then inventarioSucursal. */
async function bloquearStockEInventario(
  tx: Prisma.TransactionClient,
  p: ParametrosEdicionEntrada,
  mov: MovimientoBloqueado
) {
  const stocks = await tx.$queryRaw<Array<{ id: bigint; cantidad: unknown }>>`SELECT id, cantidad FROM \`stockLoteSucursal\` WHERE sucursal_id = ${p.sucursalId} AND lote_id = ${mov.lote_id} FOR UPDATE`;
  const inventarios = await tx.$queryRaw<
    Array<{ id: bigint; stock: unknown; costo_promedio: unknown }>
  >`SELECT id, stock, costo_promedio FROM \`inventarioSucursal\` WHERE sucursal_id = ${p.sucursalId} AND item_id = ${mov.item_id} FOR UPDATE`;
  if (!inventarios?.[0]) throw new Error("INVENTARIO_SUCURSAL_NOT_FOUND");
  return { stockLote: stocks?.[0] ?? null, inventario: inventarios[0] };
}

/**
 * Atomic edit of a manual entrada. Must run inside runWithRetry.
 * Phase A: FOR UPDATE locks (movimiento, lote, then stockLoteSucursal and
 * inventarioSucursal only when quantity or cost change).
 * Phase B: plain consistent reads, only after the last lock.
 * Phase C: writes and audit rows. No Prisma write happens before Phase B ends,
 * because Prisma update calls issue their own SELECTs.
 */
export async function ejecutarEdicionEntradaTx(
  tx: Prisma.TransactionClient,
  p: ParametrosEdicionEntrada
): Promise<ResultadoEdicionEntrada> {
  const { mov, lote } = await bloquearMovimientoYLote(tx, p);
  const loteId = BigInt(lote.id);
  const cantidadActual = aNumero(mov.cantidad);
  const costoActual = aNumero(mov.costo_unit);

  const cambios = calcularCambiosEntrada(
    {
      codigo_lote: lote.codigo_lote,
      fecha_caducidad: lote.fecha_caducidad,
      referencia: mov.referencia,
      cantidad: cantidadActual,
      costo_unit: costoActual,
    },
    p.solicitud
  );
  if (cambios.length === 0) return { sinCambios: true };

  const cambiaCantidad = cambios.some((c) => c.campo === "cantidad");
  const cambiaCosto = cambios.some((c) => c.campo === "costo_unit");
  const cambiaCantidadOCosto = cambiaCantidad || cambiaCosto;
  const nuevaCantidad = cambiaCantidad
    ? round3Decimals(p.solicitud.cantidad as number)
    : cantidadActual;
  const nuevoCosto = cambiaCosto ? round6Decimals(p.solicitud.costo_unit as number) : costoActual;
  if (nuevaCantidad <= 0) {
    throw new ValidationError("Cantidad debe ser un número mayor a 0", "cantidad");
  }

  const bloqueos = cambiaCantidadOCosto ? await bloquearStockEInventario(tx, p, mov) : null;

  // Phase B: every plain read happens after the last lock.
  const agregado = await tx.movimientoInventario.aggregate({
    where: { lote_id: loteId },
    _min: { id: true },
    _count: { _all: true },
  });
  const consumos: number = await tx.produccionItem.count({ where: { lote_consumido_id: loteId } });

  const estado = evaluarEditabilidad({
    tipo: mov.tipo,
    motivo: mov.motivo,
    loteId,
    movimientoId: BigInt(mov.id),
    cantidadMovimiento: cantidadActual,
    primerMovimientoLoteId: agregado._min.id ?? null,
    totalMovimientosLote: agregado._count._all,
    consumosProduccionLote: consumos,
    cantidadStockLote: bloqueos?.stockLote ? aNumero(bloqueos.stockLote.cantidad) : null,
  });
  if (!estado.editable) throw new EdicionEntradaError("ENTRADA_NO_EDITABLE");
  if (cambiaCantidadOCosto && !estado.cantidadCostoEditables) {
    throw new EdicionEntradaError("CANTIDAD_COSTO_NO_EDITABLES");
  }

  let inventario: { stock: number; costo_promedio: number } | undefined;
  if (bloqueos) {
    const lotesItem: Array<{ lote_id: bigint; cantidad: unknown; lote: { costo_unit: unknown } }> =
      await tx.stockLoteSucursal.findMany({
        where: { sucursal_id: p.sucursalId, lote: { item_id: mov.item_id }, cantidad: { gt: 0 } },
        select: { lote_id: true, cantidad: true, lote: { select: { costo_unit: true } } },
      });
    inventario = {
      stock: round3Decimals(aNumero(bloqueos.inventario.stock) - cantidadActual + nuevaCantidad),
      costo_promedio: recalcularCostoPromedioDesdeLotes(
        lotesItem.map((l) => ({
          lote_id: BigInt(l.lote_id),
          cantidad: aNumero(l.cantidad),
          costo_unit: aNumero(l.lote.costo_unit),
        })),
        { lote_id: loteId, cantidad: nuevaCantidad, costo_unit: nuevoCosto }
      ),
    };
  }

  // Phase C: writes.
  const datosLote: Prisma.loteUpdateInput = {};
  const datosMovimiento: Prisma.movimientoInventarioUpdateInput = {};
  for (const cambio of cambios) {
    if (cambio.campo === "codigo_lote") datosLote.codigo_lote = cambio.nuevo as string;
    if (cambio.campo === "fecha_caducidad") {
      datosLote.fecha_caducidad = cambio.nuevo ? new Date(`${cambio.nuevo}T00:00:00.000Z`) : null;
    }
    if (cambio.campo === "referencia") datosMovimiento.referencia = cambio.nuevo;
  }
  if (cambiaCosto) {
    datosLote.costo_unit = nuevoCosto;
    datosMovimiento.costo_unit = nuevoCosto;
  }
  if (cambiaCantidad) datosMovimiento.cantidad = nuevaCantidad;

  if (Object.keys(datosLote).length > 0) {
    await tx.lote.update({ where: { id: loteId }, data: datosLote });
  }
  if (Object.keys(datosMovimiento).length > 0) {
    await tx.movimientoInventario.update({ where: { id: p.movimientoId }, data: datosMovimiento });
  }
  if (bloqueos && inventario) {
    if (cambiaCantidad) {
      await tx.stockLoteSucursal.update({
        where: { id: bloqueos.stockLote!.id },
        data: { cantidad: nuevaCantidad },
      });
    }
    await tx.inventarioSucursal.update({ where: { id: bloqueos.inventario.id }, data: inventario });
  }
  await tx.auditoriaEntrada.createMany({
    data: construirRegistrosAuditoria(cambios, {
      movimientoId: p.movimientoId,
      loteId,
      sucursalId: p.sucursalId,
      empleadoId: p.empleadoId,
    }),
  });

  return { sinCambios: false, cambios, ...(inventario ? { inventario } : {}) };
}
