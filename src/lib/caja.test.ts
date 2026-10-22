import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { calcularResumenCaja } from "./caja";

describe("calcularResumenCaja", () => {
  it("queries only orders with estado: 'PAGADO' and excludes ANULADO orders", async () => {
    let capturedWhere: any = null;

    const originalFindMany = prisma.factura.findMany;
    prisma.factura.findMany = (async (args: any) => {
      capturedWhere = args?.where;
      return [
        { importe_total: 150, metodo_pago: "cash" },
        { importe_total: 80, metodo_pago: "card" },
        { importe_total: 45, metodo_pago: "qr" },
      ];
    }) as any;

    try {
      const caja = {
        id: BigInt(42),
        saldo_inicial: 200,
        fecha_apertura: new Date("2026-10-20T10:00:00Z"),
      };

      const resumen = await calcularResumenCaja(caja);

      // Verify that the query explicitly filtered by caja_id and estado: "PAGADO"
      assert.equal(capturedWhere?.pedido?.caja_id, BigInt(42));
      assert.equal(capturedWhere?.pedido?.estado, "PAGADO");

      // Verify calculations
      assert.equal(resumen.cajaId, "42");
      assert.equal(resumen.saldoInicial, 200);
      assert.equal(resumen.ventasPorMetodo.ventas_efectivo, 150);
      assert.equal(resumen.ventasPorMetodo.ventas_tarjeta, 80);
      assert.equal(resumen.ventasPorMetodo.ventas_qr, 45);
      assert.equal(resumen.ventasPorMetodo.ventas_transfer, 0);
      assert.equal(resumen.totalVentas, 275);
      assert.equal(resumen.efectivoEsperado, 350); // 200 + 150
    } finally {
      prisma.factura.findMany = originalFindMany;
    }
  });

  it("excludes annulled orders from shift summary calculations", async () => {
    const originalFindMany = prisma.factura.findMany;

    // Simulate database returning only the non-annulled order because of estado: 'PAGADO' filter
    prisma.factura.findMany = (async (args: any) => {
      if (args?.where?.pedido?.estado === "PAGADO") {
        return [{ importe_total: 100, metodo_pago: "cash" }];
      }
      return [
        { importe_total: 100, metodo_pago: "cash" },
        { importe_total: 500, metodo_pago: "cash" }, // from ANULADO order
      ];
    }) as any;

    try {
      const caja = {
        id: BigInt(10),
        saldo_inicial: 50,
        fecha_apertura: new Date(),
      };

      const resumen = await calcularResumenCaja(caja);

      assert.equal(resumen.ventasPorMetodo.ventas_efectivo, 100);
      assert.equal(resumen.totalVentas, 100);
      assert.equal(resumen.efectivoEsperado, 150);
    } finally {
      prisma.factura.findMany = originalFindMany;
    }
  });

  it("handles empty shift without sales", async () => {
    const originalFindMany = prisma.factura.findMany;
    prisma.factura.findMany = (async () => []) as any;

    try {
      const caja = {
        id: BigInt(99),
        saldo_inicial: 100,
        fecha_apertura: new Date(),
      };

      const resumen = await calcularResumenCaja(caja);

      assert.equal(resumen.totalVentas, 0);
      assert.equal(resumen.efectivoEsperado, 100);
      assert.equal(resumen.ventasPorMetodo.ventas_efectivo, 0);
    } finally {
      prisma.factura.findMany = originalFindMany;
    }
  });
});
