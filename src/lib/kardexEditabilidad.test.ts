/* eslint-disable @typescript-eslint/no-explicit-any -- mocked prisma client */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcularFlagsKardex,
  cargarEstadoEdicionLotes,
} from "./kardexEditabilidad";

const SUC = BigInt(1);

function fila(over: Partial<Parameters<typeof calcularFlagsKardex>[0]>) {
  return {
    id: BigInt(10),
    tipo: "Entrada",
    motivo: "Compra",
    loteId: BigInt(50),
    cantidad: 10,
    ...over,
  };
}

const estadoSinTocar = {
  primerMovimientoId: BigInt(10),
  totalMovimientos: 1,
  consumosProduccion: 0,
  cantidadStock: 10,
};

describe("calcularFlagsKardex", () => {
  it("manual Compra untouched -> both true", () => {
    assert.deepEqual(calcularFlagsKardex(fila({}), estadoSinTocar), {
      editable: true,
      cantidadCostoEditables: true,
    });
  });

  it("manual Compra consumed -> metadata only", () => {
    const r = calcularFlagsKardex(fila({}), { ...estadoSinTocar, cantidadStock: 4 });
    assert.deepEqual(r, { editable: true, cantidadCostoEditables: false });
  });

  it("Produccion -> neither", () => {
    const r = calcularFlagsKardex(fila({ motivo: "Produccion" }), estadoSinTocar);
    assert.deepEqual(r, { editable: false, cantidadCostoEditables: false });
  });

  it("restoration Ajuste (not first movement) -> neither", () => {
    const r = calcularFlagsKardex(fila({ motivo: "Ajuste", id: BigInt(99) }), {
      ...estadoSinTocar,
      totalMovimientos: 2,
    });
    assert.deepEqual(r, { editable: false, cantidadCostoEditables: false });
  });

  it("Salida -> neither", () => {
    const r = calcularFlagsKardex(fila({ tipo: "Salida" }), estadoSinTocar);
    assert.deepEqual(r, { editable: false, cantidadCostoEditables: false });
  });

  it("row without lote or state -> neither", () => {
    assert.deepEqual(calcularFlagsKardex(fila({ loteId: null }), undefined), {
      editable: false,
      cantidadCostoEditables: false,
    });
  });
});

function prismaMock() {
  const llamadas: string[] = [];
  const prisma = {
    movimientoInventario: {
      groupBy: async () => {
        llamadas.push("mov.groupBy");
        return [
          { lote_id: BigInt(50), _min: { id: BigInt(10) }, _count: { _all: 1 } },
        ];
      },
    },
    stockLoteSucursal: {
      findMany: async () => {
        llamadas.push("stock.findMany");
        return [{ lote_id: BigInt(50), cantidad: "10.000" }];
      },
    },
    produccionItem: {
      groupBy: async () => {
        llamadas.push("prod.groupBy");
        return [{ lote_consumido_id: BigInt(51), _count: { _all: 2 } }];
      },
    },
  };
  return { prisma: prisma as any, llamadas };
}

describe("cargarEstadoEdicionLotes", () => {
  it("runs exactly 3 batched queries and maps state by lote", async () => {
    const { prisma, llamadas } = prismaMock();
    const ids = [BigInt(50), BigInt(51), BigInt(52), BigInt(53)];
    const mapa = await cargarEstadoEdicionLotes(prisma, SUC, ids);
    assert.equal(llamadas.length, 3);
    assert.deepEqual(mapa.get("50"), estadoSinTocar);
    assert.equal(mapa.get("51")?.consumosProduccion, 2);
    assert.equal(mapa.get("51")?.cantidadStock, null);
  });

  it("query count does not depend on the number of rows", async () => {
    const a = prismaMock();
    await cargarEstadoEdicionLotes(a.prisma, SUC, [BigInt(50)]);
    const b = prismaMock();
    await cargarEstadoEdicionLotes(
      b.prisma,
      SUC,
      Array.from({ length: 40 }, (_, i) => BigInt(i + 1))
    );
    assert.equal(a.llamadas.length, b.llamadas.length);
  });

  it("makes zero queries for empty ids", async () => {
    const { prisma, llamadas } = prismaMock();
    const mapa = await cargarEstadoEdicionLotes(prisma, SUC, []);
    assert.equal(llamadas.length, 0);
    assert.equal(mapa.size, 0);
  });
});
