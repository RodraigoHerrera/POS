import { Prisma } from "@prisma/client";
import { METODO_A_COLUMNA } from "@/lib/caja";
import { inicioDiaLocal, sumarDias } from "@/lib/mrp/zonaHoraria";

// Reporte de ventas (CSV). Funciones puras: la ruta hace las consultas y estas
// transforman objetos planos (Decimal/BigInt llegan tal cual de Prisma y se
// convierten aqui con toString()).

export type TipoReporte = "usuario" | "caja" | "producto-resumen" | "producto-detalle" | "anuladas";

const TIPOS: readonly TipoReporte[] = ["usuario", "caja", "producto-resumen", "producto-detalle", "anuladas"];

export function parseTipoReporte(valor: string | null | undefined): TipoReporte | null {
  return TIPOS.find((t) => t === valor) ?? null;
}

export type FormatoReporte = "csv" | "json";

/** `json` devuelve cabeceras y filas para la vista previa; cualquier otro valor es CSV. */
export function parseFormatoReporte(valor: string | null | undefined): FormatoReporte {
  return valor === "json" ? "json" : "csv";
}

/** Filas maximas que devuelve la vista previa JSON; el CSV siempre va completo. */
export const LIMITE_VISTA_PREVIA = 500;

/**
 * Recorta las filas de la vista previa. `total` permite informar el conteo real
 * cuando la consulta ya vino limitada desde la base.
 */
export function recortarVistaPrevia<T>(
  filas: readonly T[],
  total: number = filas.length,
  limite: number = LIMITE_VISTA_PREVIA
): { filas: T[]; total: number; truncado: boolean } {
  return { filas: filas.slice(0, limite), total, truncado: total > limite };
}

export class ReporteVentasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReporteVentasError";
  }
}

export const MAX_DIAS_REPORTE = 366;

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

function esDiaValido(clave: string): boolean {
  return FORMATO_DIA.test(clave) && sumarDias(clave, 0) === clave;
}

/**
 * Valida `desde`/`hasta` (YYYY-MM-DD, dias locales de `tz`) y devuelve el rango
 * UTC [inicio, fin) donde `fin` es el inicio del dia siguiente a `hasta`.
 */
export function parseRangoFechas(
  desde: string | null | undefined,
  hasta: string | null | undefined,
  tz: string
): { desde: string; hasta: string; inicio: Date; fin: Date } {
  if (!desde || !hasta) {
    throw new ReporteVentasError("Debes indicar las fechas desde y hasta.");
  }
  if (!esDiaValido(desde) || !esDiaValido(hasta)) {
    throw new ReporteVentasError("Formato de fecha inválido. Usa AAAA-MM-DD.");
  }
  if (desde > hasta) {
    throw new ReporteVentasError("La fecha desde no puede ser posterior a hasta.");
  }
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
  if (dias > MAX_DIAS_REPORTE) {
    throw new ReporteVentasError(`El rango máximo es de ${MAX_DIAS_REPORTE} días.`);
  }
  return {
    desde,
    hasta,
    inicio: inicioDiaLocal(desde, tz),
    fin: inicioDiaLocal(sumarDias(hasta, 1), tz),
  };
}

/** `YYYY-MM-DD HH:mm` en la zona `tz`; vacio si no hay fecha. */
export function formatearFechaLocal(fecha: Date | null | undefined, tz: string): string {
  if (!fecha) return "";
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(fecha)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return `${out.year}-${out.month}-${out.day} ${out.hour}:${out.minute}`;
}

// ---------------------------------------------------------------- CSV

export type Celda = string | number | null | undefined;

function escaparCelda(celda: Celda): string {
  if (celda === null || celda === undefined) return "";
  let texto: string;
  if (typeof celda === "number") {
    if (!Number.isFinite(celda)) return "";
    // Decimal comma: Spanish-locale Excel reads "1234.50" as 123450.
    texto = celda.toFixed(2).replace(".", ",");
  } else {
    texto = /^[=+\-@]/.test(celda) ? `'${celda}` : celda;
  }
  return /[";\r\n]/.test(texto) ?`"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV con BOM UTF-8, separador ";", coma decimal y CRLF: formato de Excel con configuracion regional en espanol. */
export function generarCSV(cabeceras: readonly string[], filas: readonly (readonly Celda[])[]): string {
  const lineas = [cabeceras, ...filas].map((f) => f.map(escaparCelda).join(";"));
  return `﻿${lineas.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------- helpers

type Num = number | string | bigint | { toString(): string } | null | undefined;

const dec = (v: Num) => new Prisma.Decimal(v?.toString() ?? "0");
const num = (d: Prisma.Decimal) => d.toDecimalPlaces(2).toNumber();
const texto = (v: { toString(): string } | null | undefined) => v?.toString() ?? "";
const pct = (parte: Prisma.Decimal, total: Prisma.Decimal) =>
  total.isZero() ? 0 : num(parte.div(total).mul(100));

const ETIQUETA_METODO: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  qr: "QR",
  transfer: "Transferencia",
  giftcard: "Gift card",
};
const etiquetaMetodo = (m: string | null | undefined) => (m ? (ETIQUETA_METODO[m] ?? m) : "");

export interface EmpleadoInfo {
  nombre: string;
  usuario: string;
  rol: string;
}

// ---------------------------------------------------------------- por usuario

export const CABECERAS_USUARIO = [
  "Empleado ID", "Nombre", "Usuario", "Rol", "Pedidos", "Unidades",
  "Venta total", "Costo total", "Margen", "Margen %", "Ticket promedio",
] as const;

export interface VentaUsuarioInput {
  empleado_id: Num;
  pedido_id: Num;
  cantidad: number;
  venta_total: Num;
  costo_total: Num;
}

export function filasPorUsuario(
  ventas: readonly VentaUsuarioInput[],
  empleados: ReadonlyMap<string, EmpleadoInfo>
): Celda[][] {
  const grupos = new Map<string, { pedidos: Set<string>; unidades: number; venta: Prisma.Decimal; costo: Prisma.Decimal }>();
  for (const v of ventas) {
    const id = texto(v.empleado_id);
    const g = grupos.get(id) ?? { pedidos: new Set(), unidades: 0, venta: dec(0), costo: dec(0) };
    g.pedidos.add(texto(v.pedido_id));
    g.unidades += v.cantidad;
    g.venta = g.venta.add(dec(v.venta_total));
    g.costo = g.costo.add(dec(v.costo_total));
    grupos.set(id, g);
  }
  return [...grupos.entries()]
    .sort((a, b) => b[1].venta.comparedTo(a[1].venta))
    .map(([id, g]) => {
      const e = empleados.get(id);
      const margen = g.venta.sub(g.costo);
      return [
        id, e?.nombre ?? "", e?.usuario ?? "", e?.rol ?? "",
        String(g.pedidos.size), String(g.unidades),
        num(g.venta), num(g.costo), num(margen), pct(margen, g.venta),
        g.pedidos.size ? num(g.venta.div(g.pedidos.size)) : 0,
      ];
    });
}

/** Adapta `groupBy([empleado_id, pedido_id])` a las filas de `filasPorUsuario` (una por pedido). */
export function ventasUsuarioDesdeGrupos(
  grupos: readonly {
    empleado_id: Num;
    pedido_id: Num;
    _sum: { cantidad: number | null; venta_total: Num; costo_total: Num };
  }[]
): VentaUsuarioInput[] {
  return grupos.map((g) => ({
    empleado_id: g.empleado_id,
    pedido_id: g.pedido_id,
    cantidad: g._sum.cantidad ?? 0,
    venta_total: g._sum.venta_total ?? 0,
    costo_total: g._sum.costo_total ?? 0,
  }));
}

// ---------------------------------------------------------------- por producto

export const CABECERAS_PRODUCTO_RESUMEN = [
  "Producto ID", "Producto", "SKU", "Categoría", "Unidades", "Precio promedio",
  "Venta total", "Costo real", "Costo teórico", "Brecha (real-teórico)",
  "Margen", "Margen %", "% de la venta",
] as const;

export interface VentaProductoInput {
  producto_id: Num;
  producto_nombre: string;
  sku_producto: string | null;
  categoria: string | null;
  cantidad: number;
  venta_total: Num;
  costo_total: Num;
  costo_teorico_total: Num;
}

/** Adapta `groupBy([producto_id, producto_nombre, sku_producto, categoria])` a `filasProductoResumen`. */
export function ventasProductoDesdeGrupos(
  grupos: readonly {
    producto_id: Num;
    producto_nombre: string;
    sku_producto: string | null;
    categoria: string | null;
    _sum: { cantidad: number | null; venta_total: Num; costo_total: Num; costo_teorico_total: Num };
  }[]
): VentaProductoInput[] {
  return grupos.map((g) => ({
    producto_id: g.producto_id,
    producto_nombre: g.producto_nombre,
    sku_producto: g.sku_producto,
    categoria: g.categoria,
    cantidad: g._sum.cantidad ?? 0,
    venta_total: g._sum.venta_total ?? 0,
    costo_total: g._sum.costo_total ?? 0,
    costo_teorico_total: g._sum.costo_teorico_total ?? 0,
  }));
}

export function filasProductoResumen(ventas: readonly VentaProductoInput[]): Celda[][] {
  const grupos = new Map<string, {
    nombre: string; sku: string; categoria: string; unidades: number;
    venta: Prisma.Decimal; costo: Prisma.Decimal; teorico: Prisma.Decimal;
  }>();
  let totalVenta = dec(0);
  for (const v of ventas) {
    const id = texto(v.producto_id);
    const g = grupos.get(id) ?? {
      nombre: v.producto_nombre, sku: v.sku_producto ?? "", categoria: v.categoria ?? "",
      unidades: 0, venta: dec(0), costo: dec(0), teorico: dec(0),
    };
    const venta = dec(v.venta_total);
    g.unidades += v.cantidad;
    g.venta = g.venta.add(venta);
    g.costo = g.costo.add(dec(v.costo_total));
    g.teorico = g.teorico.add(dec(v.costo_teorico_total));
    totalVenta = totalVenta.add(venta);
    grupos.set(id, g);
  }
  return [...grupos.entries()]
    .sort((a, b) => b[1].venta.comparedTo(a[1].venta))
    .map(([id, g]) => {
      const margen = g.venta.sub(g.costo);
      return [
        id, g.nombre, g.sku, g.categoria, String(g.unidades),
        g.unidades ? num(g.venta.div(g.unidades)) : 0,
        num(g.venta), num(g.costo), num(g.teorico), num(g.costo.sub(g.teorico)),
        num(margen), pct(margen, g.venta), pct(g.venta, totalVenta),
      ];
    });
}

export const CABECERAS_PRODUCTO_DETALLE = [
  "Fecha", "Pedido", "Factura", "Producto", "SKU", "Categoría", "Cantidad",
  "Precio unitario", "Venta total", "Costo real", "Costo teórico", "Margen",
  "Método de pago", "Cliente", "Empleado",
] as const;

export interface VentaDetalleInput {
  fecha_venta: Date;
  pedido_id: Num;
  numero_factura: string | null;
  producto_nombre: string;
  sku_producto: string | null;
  categoria: string | null;
  cantidad: number;
  precio_unitario: Num;
  venta_total: Num;
  costo_total: Num;
  costo_teorico_total: Num;
  metodo_pago: string;
  nombre_cliente: string | null;
  empleado_id: Num;
}

export function filasProductoDetalle(
  ventas: readonly VentaDetalleInput[],
  empleados: ReadonlyMap<string, EmpleadoInfo>,
  tz: string
): Celda[][] {
  return ventas.map((v) => [
    formatearFechaLocal(v.fecha_venta, tz),
    texto(v.pedido_id),
    v.numero_factura ?? "",
    v.producto_nombre,
    v.sku_producto ?? "",
    v.categoria ?? "",
    String(v.cantidad),
    num(dec(v.precio_unitario)),
    num(dec(v.venta_total)),
    num(dec(v.costo_total)),
    num(dec(v.costo_teorico_total)),
    num(dec(v.venta_total).sub(dec(v.costo_total))),
    etiquetaMetodo(v.metodo_pago),
    v.nombre_cliente ?? "",
    empleados.get(texto(v.empleado_id))?.nombre ?? "",
  ]);
}

// ---------------------------------------------------------------- por caja

export const CABECERAS_CAJA = [
  "Caja ID", "Cajero", "Estado", "Apertura", "Cierre", "Saldo inicial",
  "Efectivo", "Tarjeta", "QR", "Transferencia", "Gift card", "Otros", "Total ventas",
  "Tickets", "Entradas efectivo", "Salidas efectivo", "Efectivo esperado",
  "Efectivo contado", "Diferencia efectivo", "Declarado tarjeta", "Diferencia tarjeta",
  "Declarado QR", "Diferencia QR", "Observaciones",
] as const;

export interface CajaReporteInput {
  id: Num;
  cajero: string;
  estado: string;
  fecha_apertura: Date;
  fecha_cierre: Date | null;
  saldo_inicial: Num;
  saldo_final: Num;
  diferencia_efectivo: Num;
  declarado_tarjeta: Num;
  diferencia_tarjeta: Num;
  declarado_qr: Num;
  diferencia_qr: Num;
  observaciones: string | null;
}

export interface FacturaCajaInput {
  caja_id: Num;
  metodo_pago: string;
  importe_total: Num;
}

export interface MovimientoCajaInput {
  caja_id: Num;
  tipo: string;
  monto: Num;
}

const opcional = (v: Num): number | null => (v === null || v === undefined ? null : num(dec(v)));

const COLUMNAS_METODO = [
  "ventas_efectivo", "ventas_tarjeta", "ventas_qr", "ventas_transfer", "ventas_giftcard", "ventas_otros",
] as const;

/**
 * Una fila por caja. Las ventas por metodo salen de las facturas de pedidos
 * PAGADO (misma fuente que `calcularResumenCaja`) y solo cuentan movimientos
 * MANUAL como entradas/salidas; la ruta ya filtra ambos conjuntos.
 */
export function filasPorCaja(
  cajas: readonly CajaReporteInput[],
  facturas: readonly FacturaCajaInput[],
  movimientos: readonly MovimientoCajaInput[],
  tz: string
): Celda[][] {
  const facturasPorCaja = new Map<string, FacturaCajaInput[]>();
  for (const f of facturas) {
    const k = texto(f.caja_id);
    facturasPorCaja.set(k, [...(facturasPorCaja.get(k) ?? []), f]);
  }
  const movsPorCaja = new Map<string, MovimientoCajaInput[]>();
  for (const m of movimientos) {
    const k = texto(m.caja_id);
    movsPorCaja.set(k, [...(movsPorCaja.get(k) ?? []), m]);
  }

  return cajas.map((c) => {
    const id = texto(c.id);
    const fs = facturasPorCaja.get(id) ?? [];
    const porMetodo = Object.fromEntries(COLUMNAS_METODO.map((k) => [k, dec(0)])) as Record<
      (typeof COLUMNAS_METODO)[number],
      Prisma.Decimal
    >;
    let total = dec(0);
    for (const f of fs) {
      const col = (METODO_A_COLUMNA[f.metodo_pago] ?? "ventas_otros") as (typeof COLUMNAS_METODO)[number];
      const importe = dec(f.importe_total);
      porMetodo[col] = porMetodo[col].add(importe);
      total = total.add(importe);
    }
    let entradas = dec(0);
    let salidas = dec(0);
    for (const m of movsPorCaja.get(id) ?? []) {
      if (m.tipo === "INGRESO") entradas = entradas.add(dec(m.monto));
      else if (m.tipo === "EGRESO") salidas = salidas.add(dec(m.monto));
    }
    const esperado = dec(c.saldo_inicial).add(porMetodo.ventas_efectivo).add(entradas).sub(salidas);

    return [
      id, c.cajero, c.estado,
      formatearFechaLocal(c.fecha_apertura, tz), formatearFechaLocal(c.fecha_cierre, tz),
      num(dec(c.saldo_inicial)),
      ...COLUMNAS_METODO.map((k) => num(porMetodo[k])),
      num(total), String(fs.length),
      num(entradas), num(salidas), num(esperado),
      opcional(c.saldo_final), opcional(c.diferencia_efectivo),
      opcional(c.declarado_tarjeta), opcional(c.diferencia_tarjeta),
      opcional(c.declarado_qr), opcional(c.diferencia_qr),
      c.observaciones ?? "",
    ];
  });
}

// ---------------------------------------------------------------- anuladas

export const CABECERAS_ANULADAS = [
  "Pedido", "Fecha pedido", "Fecha anulación", "Tomado por", "Caja", "Cajero", "Mesa",
  "Cliente", "Estaba cobrado", "Factura", "Método de pago", "Total", "Observaciones",
] as const;

export interface PedidoAnuladoInput {
  id: Num;
  creado_en: Date;
  actualizado_en: Date;
  tomado_por: string;
  caja_id: Num;
  cajero: string | null;
  mesa: string | null;
  cliente_nombre: string | null;
  total: Num;
  observaciones: string | null;
  factura: { id: Num; metodo_pago: string; importe_total: Num } | null;
}

export function filasAnuladas(pedidos: readonly PedidoAnuladoInput[], tz: string): Celda[][] {
  return pedidos.map((p) => [
    texto(p.id),
    formatearFechaLocal(p.creado_en, tz),
    formatearFechaLocal(p.actualizado_en, tz),
    p.tomado_por,
    texto(p.caja_id),
    p.cajero ?? "",
    p.mesa ?? "",
    p.cliente_nombre ?? "",
    p.factura ? "Sí" : "No",
    texto(p.factura?.id),
    etiquetaMetodo(p.factura?.metodo_pago),
    num(dec(p.total)),
    p.observaciones ?? "",
  ]);
}
