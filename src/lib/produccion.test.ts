import "dotenv/config";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { ValidationError } from "./validation";
import {
  validarEntradaProduccion,
  esItemProducible,
  ejecutarProduccionTx,
  ejecutarProduccion,
} from "./produccion";

function crearMockTx(tipoSalida: string) {
  const escrituras: Array<{ op: string; data: any; where?: any }> = [];
  const registrar = (op: string) => async (args: any) => {
    escrituras.push({ op, data: args.data, where: args.where });
    return { id: BigInt(900), ...args.data };
  };

  const tx = {
    receta: {
      findUnique: async () => ({
        id: BigInt(1),
        item_vendible_id: BigInt(50),
        items: [{ item_insumo_id: BigInt(10), cantidad: new Prisma.Decimal(2) }],
      }),
    },
    item: {
      findUnique: async () => ({ id: BigInt(50), tipo: tipoSalida, vida_util_dias: null }),
    },
    stockLoteSucursal: {
      findMany: async () => [
        {
          cantidad: new Prisma.Decimal(100),
          lote: { id: BigInt(7), costo_unit: new Prisma.Decimal(3) },
        },
      ],
      update: registrar("stockLoteSucursal.update"),
      create: registrar("stockLoteSucursal.create"),
    },
    inventarioSucursal: {
      findUnique: async () => null,
      update: registrar("inventarioSucursal.update"),
      create: registrar("inventarioSucursal.create"),
    },
    movimientoInventario: { create: registrar("movimientoInventario.create") },
    lote: { create: registrar("lote.create") },
    produccion: { create: registrar("produccion.create") },
    produccionItem: { createMany: registrar("produccionItem.createMany") },
  };

  return { tx, escrituras };
}

describe("produccion: session-scoped auth gate", () => {
  it("rejects a call without a session before touching the database", async () => {
    const sinCookies = { get: () => undefined };
    const resultado = await ejecutarProduccion(
      { recipeId: "1", quantity: 5, sucursalId: "1" },
      sinCookies
    );
    assert.equal(resultado.success, false);
    assert.equal(resultado.message, "No autorizado");
  });

  it("ignores any client-supplied sucursalId", () => {
    const entrada = validarEntradaProduccion({ recipeId: "3", quantity: "2.5", sucursalId: "99" });
    assert.deepEqual(Object.keys(entrada).sort(), ["cantidad", "recetaId"]);
    assert.equal(entrada.recetaId, BigInt(3));
    assert.ok(entrada.cantidad.equals(new Prisma.Decimal("2.5")));
  });

  for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "abc", null]) {
    it(`rejects invalid quantity ${String(quantity)}`, () => {
      assert.throws(() => validarEntradaProduccion({ recipeId: "1", quantity }), ValidationError);
    });
  }

  it("rejects an invalid recipe id", () => {
    assert.throws(() => validarEntradaProduccion({ recipeId: "x", quantity: 1 }), ValidationError);
  });

  it("writes every row to the session branch", async () => {
    const { tx, escrituras } = crearMockTx("prep");
    await ejecutarProduccionTx(tx, {
      sucursalId: BigInt(4),
      recetaId: BigInt(1),
      cantidad: new Prisma.Decimal(5),
    });

    const conSucursal = escrituras.filter(
      (e) => e.data?.sucursal_id !== undefined || e.where?.sucursal_id_lote_id || e.where?.sucursal_id_item_id
    );
    assert.ok(conSucursal.length >= 6);
    for (const e of conSucursal) {
      const sucursal =
        e.data?.sucursal_id ??
        e.where?.sucursal_id_lote_id?.sucursal_id ??
        e.where?.sucursal_id_item_id?.sucursal_id;
      assert.equal(sucursal, BigInt(4), `${e.op} used another branch`);
    }
  });
});

describe("produccion: only prep items are producible", () => {
  it("accepts prep and rejects every other item type", () => {
    assert.equal(esItemProducible("prep"), true);
    for (const tipo of ["vendible", "insumo", "oficina"]) {
      assert.equal(esItemProducible(tipo), false);
    }
  });

  it("rejects producing a vendible inside the transaction without writing", async () => {
    const { tx, escrituras } = crearMockTx("vendible");
    await assert.rejects(
      ejecutarProduccionTx(tx, {
        sucursalId: BigInt(1),
        recetaId: BigInt(1),
        cantidad: new Prisma.Decimal(5),
      }),
      /preparación/
    );
    assert.equal(escrituras.length, 0);
  });
});
