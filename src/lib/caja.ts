import { prisma } from "@/lib/db";

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
 */
export async function calcularResumenCaja(caja: {
  id: bigint;
  saldo_inicial: unknown;
  fecha_apertura: Date;
}): Promise<ResumenCaja> {
  const facturas = await prisma.factura.findMany({
    where: { pedido: { caja_id: caja.id } },
    select: { importe_total: true, metodo_pago: true },
  });

  const ventasPorMetodo = {
    ventas_efectivo: 0,
    ventas_tarjeta: 0,
    ventas_qr: 0,
    ventas_transfer: 0,
    ventas_giftcard: 0,
    ventas_otros: 0,
  };

  for (const f of facturas) {
    const columna = (METODO_A_COLUMNA[f.metodo_pago] ?? "ventas_otros") as keyof typeof ventasPorMetodo;
    ventasPorMetodo[columna] += Number(f.importe_total);
  }

  const totalVentas = Object.values(ventasPorMetodo).reduce((acc, v) => acc + v, 0);
  const saldoInicial = Number(caja.saldo_inicial);
  const efectivoEsperado = saldoInicial + ventasPorMetodo.ventas_efectivo;

  return {
    cajaId: caja.id.toString(),
    saldoInicial,
    fechaApertura: caja.fecha_apertura,
    ventasPorMetodo,
    totalVentas,
    efectivoEsperado,
  };
}
