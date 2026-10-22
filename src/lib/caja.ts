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
export async function calcularResumenCaja(caja: {
  id: bigint;
  saldo_inicial: unknown;
  fecha_apertura: Date;
}): Promise<ResumenCaja> {
  const facturas = await prisma.factura.findMany({
    where: {
      pedido: {
        caja_id: caja.id,
        estado: "PAGADO",
      },
    },
    select: { importe_total: true, metodo_pago: true },
  });

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

  const efectivoEsperadoDec = saldoInicialDec.add(decimalesPorMetodo.ventas_efectivo);

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
    efectivoEsperado: efectivoEsperadoDec.toDecimalPlaces(2).toNumber(),
  };
}
