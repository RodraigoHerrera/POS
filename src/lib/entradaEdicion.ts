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
