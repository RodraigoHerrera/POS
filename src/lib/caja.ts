import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const METODO_A_COLUMNA: Record<string, string> = {
  cash: "ventas_efectivo",
  card: "ventas_tarjeta",
  qr: "ventas_qr",
  transfer: "ventas_transfer",
  giftcard: "ventas_giftcard",
};

export interface ResumenCaja {
  cajaId: string;
  saldoInicial: number;
  fechaApertura: Date;
  ventasPorMetodo: {
    ventas_efectivo: number;
    ventas_tarjeta: number;
    ventas_qr: number;
    ventas_transfer: number;
    ventas_giftcard: number;
    ventas_otros: number;
  };
  totalVentas: number;
  /** Entradas manuales de efectivo (movimientos MANUAL tipo INGRESO). */
  entradasEfectivo: number;
  /** Salidas manuales de efectivo (movimientos MANUAL tipo EGRESO). */
  salidasEfectivo: number;
  efectivoEsperado: number;
}

/**
 * Agrega las ventas facturadas de una caja por método de pago, desde
 * `factura` (vía `pedido.caja_id`), sin escribir nada. La usan tanto el
 * resumen en vivo (antes de contar) como el cierre real (que solo agrega
 * la persistencia encima de este mismo cálculo).
 *
 * Utiliza Prisma.Decimal para evitar acumulación de errores de punto flotante IEEE-754.
 */
export async function calcularResumenCaja(
  caja: {
    id: bigint;
    saldo_inicial: unknown;
    fecha_apertura: Date;
  },
  // Cliente opcional (p. ej. el `tx` de una transacción) para leer dentro de ella.
  db: Pick<typeof prisma, "factura" | "movimientoCaja"> = prisma
): Promise<ResumenCaja> {
  const facturas = await db.factura.findMany({
    where: {
      pedido: {
        caja_id: caja.id,
        estado: "PAGADO",
      },
    },
    select: { importe_total: true, metodo_pago: true },
  });

  // Solo los movimientos MANUAL cuentan: las filas VENTA/ANULACION ya están
  // reflejadas en las facturas y contarlas duplicaría las ventas.
  const movimientosManuales = await db.movimientoCaja.findMany({
    where: { caja_id: caja.id, origen: "MANUAL" },
    select: { tipo: true, monto: true },
  });
  let entradasDec = new Prisma.Decimal(0);
  let salidasDec = new Prisma.Decimal(0);
  for (const m of movimientosManuales) {
    const monto = new Prisma.Decimal(m.monto?.toString() ?? "0");
    if (m.tipo === "INGRESO") entradasDec = entradasDec.add(monto);
    else if (m.tipo === "EGRESO") salidasDec = salidasDec.add(monto);
  }

  const decimalesPorMetodo = {
    ventas_efectivo: new Prisma.Decimal(0),
    ventas_tarjeta: new Prisma.Decimal(0),
    ventas_qr: new Prisma.Decimal(0),
    ventas_transfer: new Prisma.Decimal(0),
    ventas_giftcard: new Prisma.Decimal(0),
    ventas_otros: new Prisma.Decimal(0),
  };

  for (const f of facturas) {
    const columna = (METODO_A_COLUMNA[f.metodo_pago] ?? "ventas_otros") as keyof typeof decimalesPorMetodo;
    const importeStr = f.importe_total?.toString() ?? "0";
    decimalesPorMetodo[columna] = decimalesPorMetodo[columna].add(new Prisma.Decimal(importeStr));
  }

  const saldoInicialDec = new Prisma.Decimal(caja.saldo_inicial?.toString() ?? "0");
  let totalVentasDec = new Prisma.Decimal(0);
  for (const val of Object.values(decimalesPorMetodo)) {
    totalVentasDec = totalVentasDec.add(val);
  }

  const efectivoEsperadoDec = saldoInicialDec
    .add(decimalesPorMetodo.ventas_efectivo)
    .add(entradasDec)
    .sub(salidasDec);

  const ventasPorMetodo = {
    ventas_efectivo: decimalesPorMetodo.ventas_efectivo.toDecimalPlaces(2).toNumber(),
    ventas_tarjeta: decimalesPorMetodo.ventas_tarjeta.toDecimalPlaces(2).toNumber(),
    ventas_qr: decimalesPorMetodo.ventas_qr.toDecimalPlaces(2).toNumber(),
    ventas_transfer: decimalesPorMetodo.ventas_transfer.toDecimalPlaces(2).toNumber(),
    ventas_giftcard: decimalesPorMetodo.ventas_giftcard.toDecimalPlaces(2).toNumber(),
    ventas_otros: decimalesPorMetodo.ventas_otros.toDecimalPlaces(2).toNumber(),
  };

  return {
    cajaId: caja.id.toString(),
    saldoInicial: saldoInicialDec.toDecimalPlaces(2).toNumber(),
    fechaApertura: caja.fecha_apertura,
    ventasPorMetodo,
    totalVentas: totalVentasDec.toDecimalPlaces(2).toNumber(),
    entradasEfectivo: entradasDec.toDecimalPlaces(2).toNumber(),
    salidasEfectivo: salidasDec.toDecimalPlaces(2).toNumber(),
    efectivoEsperado: efectivoEsperadoDec.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Diferencia de conciliación = declarado - esperado, con Prisma.Decimal.
 * Un residuo menor a medio centavo (coma flotante) se descarta como 0;
 * en otro caso se redondea a 2 decimales. Positivo = sobrante, negativo = faltante.
 */
export function calcularDiferenciaConciliacion(declarado: number, esperado: number): number {
  const diff = new Prisma.Decimal(declarado.toString()).sub(new Prisma.Decimal(esperado.toString()));
  return diff.abs().lessThan(0.005) ? 0 : diff.toDecimalPlaces(2).toNumber();
}

export interface OrderBillingValidationInput {
  lockedOrder?: {
    id?: bigint;
    sucursal_id: bigint;
    estado: string;
    total?: unknown;
  } | null;
  sucursalId: bigint | string;
  items?: any[];
  total?: unknown;
  metodoPago?: string;
  recibido?: number;
  pedidoDetail?: {
    items?: any[];
    total?: unknown;
  } | null;
  montoPagado?: unknown;
}

/**
 * Validates order edit state invariants (INV-SEC04-1).
 * Rejects orders that are already PAGADO or ANULADO.
 */
export function validateOrderEditState(
  lockedOrder: { id?: bigint; sucursal_id?: bigint; estado: string } | null | undefined
): void {
  if (!lockedOrder) {
    throw new Error("PEDIDO_NOT_FOUND");
  }
  if (lockedOrder.estado === "PAGADO" || lockedOrder.estado === "ANULADO") {
    throw new Error("PEDIDO_ALREADY_CLOSED");
  }
}

/**
 * Validates order billing invariants (INV-SEC04-1, INV-SEC04-2).
 * Ensures order exists, belongs to caller branch, is not already closed,
 * contains at least one item, total is positive, and cash payment is sufficient.
 */
export function validateOrderForBilling(input: OrderBillingValidationInput): void {
  const { lockedOrder, sucursalId } = input;

  if (!lockedOrder || lockedOrder.sucursal_id.toString() !== sucursalId.toString()) {
    throw new Error("Pedido no encontrado");
  }

  if (lockedOrder.estado === "PAGADO") {
    throw new Error("El pedido ya fue pagado");
  }

  if (lockedOrder.estado === "ANULADO") {
    throw new Error("El pedido está anulado");
  }

  const items = input.items !== undefined ? input.items : input.pedidoDetail?.items;
  if (!items || items.length === 0) {
    throw new Error("El pedido no contiene items para facturar.");
  }

  const totalRaw =
    input.total !== undefined
      ? input.total
      : input.pedidoDetail?.total !== undefined
      ? input.pedidoDetail.total
      : lockedOrder.total;
  const totalNum = Number(totalRaw);
  if (!Number.isFinite(totalNum) || totalNum <= 0) {
    throw new Error("El total del pedido debe ser mayor a 0");
  }

  const metodo = (input.metodoPago ?? "").toLowerCase();
  const isCash = metodo === "cash" || metodo === "efectivo";
  if (isCash) {
    const recibidoRaw = input.recibido !== undefined ? input.recibido : input.montoPagado;
    const recibidoNum = Number(recibidoRaw);
    if (!Number.isFinite(recibidoNum) || recibidoNum < totalNum) {
      throw new Error("Monto pagado insuficiente");
    }
  }
}

/**
 * Validates that FEFO simulation fulfilled at least one item (INV-SEC04-4).
 * Throws a stock error recognized by isDeadlockError as fail-fast.
 */
export function validateSimulationResults(successfulItemsCount: number): void {
  if (successfulItemsCount === 0) {
    throw new Error("No hay suficiente stock para preparar ningún item de esta actualización.");
  }
}

