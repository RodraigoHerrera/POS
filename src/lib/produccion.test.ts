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
  calcularCantidadInsumo,
  ordenarLotesFEFO,
  prepararRecetasProduccion,
} from "./produccion";

interface OpcionesMockTx {
  rendimiento?: number;
  cantidadInsumo?: number;
  lotesActualizados?: number;
  inventarioSalida?: { stock: number; costo_promedio: number } | null;
}

function crearMockTx(tipoSalida: string, opciones: OpcionesMockTx = {}) {
  const escrituras: Array<{ op: string; data: any; where?: any }> = [];
  const registrar = (op: string, resultado?: unknown) => async (args: any) => {
    escrituras.push({ op, data: args.data, where: args.where });
    return resultado ?? { id: BigInt(900), ...args.data };
  };

  const salida = opciones.inventarioSalida;
  const tx = {
    receta: {
      findUnique: async () => ({
        id: BigInt(1),
        item_vendible_id: BigInt(50),
        rendimiento: new Prisma.Decimal(opciones.rendimiento ?? 1),
        merma_pct: null,
        items: [
          {
            item_insumo_id: BigInt(10),
            cantidad: new Prisma.Decimal(opciones.cantidadInsumo ?? 2),
            merma_pct: null,
          },
        ],
      }),
    },
    item: {
      findUnique: async () => ({ id: BigInt(50), tipo: tipoSalida, vida_util_dias: null }),
    },
    stockLoteSucursal: {
      findMany: async () => [
        {
          cantidad: new Prisma.Decimal(100),
          lote: {
            id: BigInt(7),
            costo_unit: new Prisma.Decimal(3),
            fecha_caducidad: null,
            creado_en: new Date("2026-01-01"),
          },
        },
      ],
      updateMany: registrar("stockLoteSucursal.updateMany", {
        count: opciones.lotesActualizados ?? 1,
      }),
      create: registrar("stockLoteSucursal.create"),
    },
    inventarioSucursal: {
      findUnique: async () =>
        salida
          ? {
              stock: new Prisma.Decimal(salida.stock),
              costo_promedio: new Prisma.Decimal(salida.costo_promedio),
            }
          : null,
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
      (e) =>
        e.data?.sucursal_id !== undefined ||
        e.where?.sucursal_id !== undefined ||
        e.where?.sucursal_id_item_id
    );
    assert.ok(conSucursal.length >= 6);
    for (const e of conSucursal) {
      const sucursal =
        e.data?.sucursal_id ??
        e.where?.sucursal_id ??
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

describe("produccion: recipe yield and waste (same formula as MRP)", () => {
  const base = {
    cantidadProducir: new Prisma.Decimal(10),
    rendimiento: new Prisma.Decimal(2),
    mermaPctReceta: null,
    cantidadInsumo: new Prisma.Decimal(3),
    mermaPctInsumo: null,
  };

  it("divides by the recipe yield", () => {
    assert.ok(calcularCantidadInsumo(base).equals(15));
  });

  it("applies recipe and ingredient waste", () => {
    const r = calcularCantidadInsumo({
      ...base,
      mermaPctReceta: new Prisma.Decimal(50),
      mermaPctInsumo: new Prisma.Decimal(25),
    });
    assert.ok(r.equals(40));
  });

  it("treats a non-positive yield as 1", () => {
    assert.ok(calcularCantidadInsumo({ ...base, rendimiento: new Prisma.Decimal(0) }).equals(30));
  });

  it("rejects waste of 100% or more", () => {
    assert.throws(
      () => calcularCantidadInsumo({ ...base, mermaPctInsumo: new Prisma.Decimal(100) }),
      /merma/i
    );
  });

  it("deducts ingredients using the recipe yield", async () => {
    const { tx, escrituras } = crearMockTx("prep", { rendimiento: 2, cantidadInsumo: 2 });
    await ejecutarProduccionTx(tx, {
      sucursalId: BigInt(1),
      recetaId: BigInt(1),
      cantidad: new Prisma.Decimal(5),
    });
    const salida = escrituras.find(
      (e) => e.op === "movimientoInventario.create" && e.data.tipo === "Salida"
    );
    assert.ok(salida);
    assert.ok(new Prisma.Decimal(salida.data.cantidad).equals(5));
  });
});

describe("produccion: FEFO ordering", () => {
  it("puts lots without expiry last, then oldest first", () => {
    const lote = (id: number, caducidad: string | null, creado: string) => ({
      lote: {
        id: BigInt(id),
        fecha_caducidad: caducidad ? new Date(caducidad) : null,
        creado_en: new Date(creado),
      },
    });
    const ordenados = ordenarLotesFEFO([
      lote(1, null, "2026-01-01"),
      lote(2, "2026-12-01", "2026-02-01"),
      lote(3, "2026-11-01", "2026-03-01"),
      lote(4, "2026-11-01", "2026-01-15"),
    ]);
    assert.deepEqual(
      ordenados.map((l) => Number(l.lote.id)),
      [4, 3, 2, 1]
    );
  });
});

describe("produccion: page view model", () => {
  const receta = (overrides: Record<string, unknown> = {}) => ({
    id: BigInt(1),
    rendimiento: new Prisma.Decimal(2),
    merma_pct: null,
    item_vendible: { nombre: "Salsa", unidad_code: "L", vida_util_dias: 3 },
    items: [
      {
        item_insumo_id: BigInt(10),
        cantidad: new Prisma.Decimal(3),
        merma_pct: null,
        item_insumo: { nombre: "Tomate", unidad_code: "kg" },
      },
    ],
    ...overrides,
  });

  it("computes per-unit quantity with the authoritative formula plus stock and cost", () => {
    const [vista] = prepararRecetasProduccion(
      [receta()],
      new Map([["10", new Prisma.Decimal("7.5")]]),
      new Map([["10", new Prisma.Decimal(4)]])
    );
    assert.equal(vista.id, "1");
    assert.equal(vista.nombre, "Salsa");
    assert.equal(vista.unidad, "L");
    assert.equal(vista.vidaUtilDias, 3);
    assert.equal(vista.error, null);
    assert.deepEqual(vista.insumos, [
      { itemId: "10", nombre: "Tomate", unidad: "kg", porUnidad: 1.5, disponible: 7.5, costoUnit: 4 },
    ]);
  });

  it("defaults missing stock and cost to zero", () => {
    const [vista] = prepararRecetasProduccion([receta()], new Map(), new Map());
    assert.equal(vista.insumos[0].disponible, 0);
    assert.equal(vista.insumos[0].costoUnit, 0);
  });

  it("flags a recipe with invalid waste instead of throwing", () => {
    const [vista] = prepararRecetasProduccion(
      [receta({ merma_pct: new Prisma.Decimal(100) })],
      new Map(),
      new Map()
    );
    assert.match(vista.error ?? "", /merma/i);
    assert.deepEqual(vista.insumos, []);
  });

  it("flags a recipe without ingredients", () => {
    const [vista] = prepararRecetasProduccion([receta({ items: [] })], new Map(), new Map());
    assert.match(vista.error ?? "", /insumos/i);
  });
});

describe("produccion: concurrency-safe writes", () => {
  it("guards the lot decrement and fails when stock changed concurrently", async () => {
    const { tx, escrituras } = crearMockTx("prep", { lotesActualizados: 0 });
    await assert.rejects(
      ejecutarProduccionTx(tx, {
        sucursalId: BigInt(1),
        recetaId: BigInt(1),
        cantidad: new Prisma.Decimal(5),
      }),
      /^Error: Stock insuficiente/
    );
    const guarda = escrituras.find((e) => e.op === "stockLoteSucursal.updateMany");
    assert.ok(guarda?.where.cantidad?.gte, "lot decrement must be conditional");
  });

  it("increments output stock instead of overwriting it", async () => {
    const { tx, escrituras } = crearMockTx("prep", {
      inventarioSalida: { stock: 10, costo_promedio: 2 },
    });
    await ejecutarProduccionTx(tx, {
      sucursalId: BigInt(1),
      recetaId: BigInt(1),
      cantidad: new Prisma.Decimal(5),
    });
    const updates = escrituras.filter(
      (e) => e.op === "inventarioSucursal.update" && e.where.sucursal_id_item_id.item_id === BigInt(50)
    );
    assert.ok(updates.some((u) => u.data.stock?.increment !== undefined));
    assert.ok(updates.every((u) => !(u.data.stock instanceof Prisma.Decimal)));
  });
});
