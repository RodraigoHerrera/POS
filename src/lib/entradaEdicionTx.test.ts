/* eslint-disable @typescript-eslint/no-explicit-any -- mocked transaction client */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runWithRetry } from "./transactionRetry";
import { ValidationError } from "./validation";
import { EdicionEntradaError, ejecutarEdicionEntradaTx } from "./entradaEdicion";

const SUCURSAL = BigInt(1);
const EMPLEADO = BigInt(7);
const MOV = BigInt(10);
const LOTE = BigInt(50);

interface Escenario {
  movimiento?: Record<string, unknown> | null;
  lote?: Record<string, unknown> | null;
  stockLoteLock?: Record<string, unknown> | null;
  inventarioLock?: Record<string, unknown> | null;
  primerMovimientoId?: bigint;
  totalMovimientos?: number;
  consumosProduccion?: number;
  lotesItem?: Array<Record<string, unknown>>;
  falloLoteUpdate?: Error;
}

const movimientoBase = {
  id: MOV,
  sucursal_id: SUCURSAL,
  item_id: BigInt(100),
  lote_id: LOTE,
  tipo: "Entrada",
  motivo: "Compra",
  cantidad: "10.000",
  costo_unit: "2.000000",
  referencia: "FAC-1",
};
const loteBase = {
  id: LOTE,
  item_id: BigInt(100),
  codigo_lote: "L-1",
  fecha_caducidad: null,
  costo_unit: "2.000000",
};

function crearTx(escenario: Escenario = {}) {
  const secuencia: string[] = [];
  const sql: string[] = [];
  const args: Record<string, any> = {};
  const valor = <T>(dado: T | null | undefined, porDefecto: T): T | null =>
    dado === null ? null : (dado ?? porDefecto);

  const tx: any = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const texto = strings.join("?");
      sql.push(texto);
      const tabla = ["movimientoInventario", "lote", "stockLoteSucursal", "inventarioSucursal"].find(
        (t) => texto.includes(`\`${t}\``)
      );
      secuencia.push(`lock:${tabla}`);
      const filas: Record<string, unknown> = {
        movimientoInventario: valor(escenario.movimiento, movimientoBase),
        lote: valor(escenario.lote, loteBase),
        stockLoteSucursal: valor(escenario.stockLoteLock, { id: BigInt(70), cantidad: "10.000" }),
        inventarioSucursal: valor(escenario.inventarioLock, {
          id: BigInt(90),
          stock: "25.000",
          costo_promedio: "3.000000",
        }),
      };
      const fila = filas[tabla as string];
      return fila ? [fila] : [];
    },
    movimientoInventario: {
      aggregate: async (a: unknown) => {
        secuencia.push("movimientoInventario.aggregate");
        args.aggregate = a;
        return {
          _min: { id: escenario.primerMovimientoId ?? MOV },
          _count: { _all: escenario.totalMovimientos ?? 1 },
        };
      },
      update: async (a: unknown) => {
        secuencia.push("movimientoInventario.update");
        args.movimientoUpdate = a;
        return {};
      },
    },
    produccionItem: {
      count: async () => {
        secuencia.push("produccionItem.count");
        return escenario.consumosProduccion ?? 0;
      },
    },
    stockLoteSucursal: {
      findMany: async () => {
        secuencia.push("stockLoteSucursal.findMany");
        return (
          escenario.lotesItem ?? [
            { lote_id: LOTE, cantidad: "10.000", lote: { costo_unit: "2.000000" } },
            { lote_id: BigInt(51), cantidad: "15.000", lote: { costo_unit: "4.000000" } },
          ]
        );
      },
      update: async (a: unknown) => {
        secuencia.push("stockLoteSucursal.update");
        args.stockLoteUpdate = a;
        return {};
      },
    },
    lote: {
      update: async (a: unknown) => {
        secuencia.push("lote.update");
        args.loteUpdate = a;
        if (escenario.falloLoteUpdate) throw escenario.falloLoteUpdate;
        return {};
      },
    },
    inventarioSucursal: {
      update: async (a: unknown) => {
        secuencia.push("inventarioSucursal.update");
        args.inventarioUpdate = a;
        return {};
      },
    },
    auditoriaEntrada: {
      createMany: async (a: unknown) => {
        secuencia.push("auditoriaEntrada.createMany");
        args.auditoria = a;
        return { count: 0 };
      },
    },
  };
  return { tx, secuencia, sql, args };
}

const parametros = (solicitud: Record<string, unknown>, sucursalId = SUCURSAL) => ({
  movimientoId: MOV,
  sucursalId,
  empleadoId: EMPLEADO,
  solicitud: solicitud as any,
});

const escrituras = (secuencia: string[]) =>
  secuencia.filter((s) => /\.(update|createMany)$/.test(s));

async function rechazadoCon(promesa: Promise<unknown>, codigo: string) {
  await assert.rejects(promesa, (e: unknown) => {
    assert.ok(e instanceof EdicionEntradaError);
    assert.equal((e as EdicionEntradaError).codigo, codigo);
    return true;
  });
}

describe("ejecutarEdicionEntradaTx - access and eligibility", () => {
  it("rejects with 404 when the movement row does not exist", async () => {
    const { tx, secuencia } = crearTx({ movimiento: null });
    await rechazadoCon(ejecutarEdicionEntradaTx(tx, parametros({ referencia: "X" })), "ENTRADA_NO_ENCONTRADA");
    assert.deepEqual(escrituras(secuencia), []);
  });

  it("rejects with 404 when the movement belongs to another sucursal", async () => {
    const { tx, secuencia } = crearTx();
    await rechazadoCon(
      ejecutarEdicionEntradaTx(tx, parametros({ referencia: "X" }, BigInt(2))),
      "ENTRADA_NO_ENCONTRADA"
    );
    assert.deepEqual(escrituras(secuencia), []);
  });

  it("rejects Salida and Produccion movements with 409 before locking the lote", async () => {
    for (const parcial of [{ tipo: "Salida" }, { motivo: "Produccion" }, { lote_id: null }]) {
      const { tx, secuencia } = crearTx({ movimiento: { ...movimientoBase, ...parcial } });
      await rechazadoCon(ejecutarEdicionEntradaTx(tx, parametros({ referencia: "X" })), "ENTRADA_NO_EDITABLE");
      assert.deepEqual(secuencia, ["lock:movimientoInventario"]);
    }
  });

  it("rejects a restoration Ajuste that is not the originating movement", async () => {
    const { tx, secuencia } = crearTx({
      movimiento: { ...movimientoBase, motivo: "Ajuste" },
      primerMovimientoId: BigInt(3),
      totalMovimientos: 2,
    });
    await rechazadoCon(ejecutarEdicionEntradaTx(tx, parametros({ referencia: "X" })), "ENTRADA_NO_EDITABLE");
    assert.deepEqual(escrituras(secuencia), []);
  });
});

describe("ejecutarEdicionEntradaTx - no-op and metadata path", () => {
  it("returns sinCambios without writes, audit or extra locks when values are equal", async () => {
    const { tx, secuencia } = crearTx();
    const r = await ejecutarEdicionEntradaTx(
      tx,
      parametros({ codigo_lote: "L-1", referencia: "FAC-1", cantidad: 10, costo_unit: 2 })
    );
    assert.deepEqual(r, { sinCambios: true });
    assert.deepEqual(secuencia, ["lock:movimientoInventario", "lock:lote"]);
  });

  it("edits metadata of a consumed lote without stock locks or costo_promedio writes", async () => {
    const { tx, secuencia, args } = crearTx({
      totalMovimientos: 3,
      consumosProduccion: 1,
      lotesItem: [],
    });
    const r = await ejecutarEdicionEntradaTx(
      tx,
      parametros({ codigo_lote: "L-2", referencia: "FAC-2", fecha_caducidad: "2026-12-31" })
    );
    assert.deepEqual(secuencia, [
      "lock:movimientoInventario",
      "lock:lote",
      "movimientoInventario.aggregate",
      "produccionItem.count",
      "lote.update",
      "movimientoInventario.update",
      "auditoriaEntrada.createMany",
    ]);
    assert.deepEqual(args.loteUpdate, {
      where: { id: LOTE },
      data: { codigo_lote: "L-2", fecha_caducidad: new Date("2026-12-31T00:00:00.000Z") },
    });
    assert.deepEqual(args.movimientoUpdate, { where: { id: MOV }, data: { referencia: "FAC-2" } });
    assert.equal(args.auditoria.data.length, 3);
    assert.equal(args.auditoria.data[0].empleado_id, EMPLEADO);
    assert.equal(r.sinCambios, false);
    assert.equal((r as any).inventario, undefined);
  });

  it("clears fecha_caducidad and referencia with nulls", async () => {
    const { tx, args } = crearTx({
      lote: { ...loteBase, fecha_caducidad: new Date("2026-06-01T00:00:00.000Z") },
    });
    await ejecutarEdicionEntradaTx(tx, parametros({ fecha_caducidad: null, referencia: null }));
    assert.deepEqual(args.loteUpdate.data, { fecha_caducidad: null });
    assert.deepEqual(args.movimientoUpdate.data, { referencia: null });
  });
});

describe("ejecutarEdicionEntradaTx - quantity and cost path", () => {
  it("writes lote, movement, stockLote and inventarioSucursal for an untouched lote", async () => {
    const { tx, secuencia, args } = crearTx();
    const r = await ejecutarEdicionEntradaTx(tx, parametros({ cantidad: 4, costo_unit: 3 }));

    assert.deepEqual(secuencia, [
      "lock:movimientoInventario",
      "lock:lote",
      "lock:stockLoteSucursal",
      "lock:inventarioSucursal",
      "movimientoInventario.aggregate",
      "produccionItem.count",
      "stockLoteSucursal.findMany",
      "lote.update",
      "movimientoInventario.update",
      "stockLoteSucursal.update",
      "inventarioSucursal.update",
      "auditoriaEntrada.createMany",
    ]);
    assert.deepEqual(args.loteUpdate.data, { costo_unit: 3 });
    assert.deepEqual(args.movimientoUpdate.data, { cantidad: 4, costo_unit: 3 });
    assert.deepEqual(args.stockLoteUpdate, { where: { id: BigInt(70) }, data: { cantidad: 4 } });
    // stock = 25 - 10 + 4; costo = (4*3 + 15*4) / 19 = 3.789474
    assert.deepEqual(args.inventarioUpdate, {
      where: { id: BigInt(90) },
      data: { stock: 19, costo_promedio: 3.789474 },
    });
    assert.deepEqual((r as any).inventario, { stock: 19, costo_promedio: 3.789474 });
  });

  it("does not update stockLote when only the cost changes", async () => {
    const { tx, secuencia, args } = crearTx();
    await ejecutarEdicionEntradaTx(tx, parametros({ costo_unit: 5 }));
    assert.ok(!secuencia.includes("stockLoteSucursal.update"));
    assert.equal(args.inventarioUpdate.data.stock, 25);
  });

  it("treats quantity and cost equal to the current values as unchanged", async () => {
    const { tx, secuencia } = crearTx({ totalMovimientos: 2 });
    const r = await ejecutarEdicionEntradaTx(
      tx,
      parametros({ cantidad: 10.0004, costo_unit: 2, referencia: "FAC-9" })
    );
    assert.equal(r.sinCambios, false);
    assert.ok(!secuencia.includes("lock:stockLoteSucursal"));
  });

  it("rejects quantity/cost edits on touched lotes and writes nothing, metadata included", async () => {
    const casos: Array<[string, Escenario]> = [
      ["stock quantity differs", { stockLoteLock: { id: BigInt(70), cantidad: "6.000" } }],
      ["extra movement", { totalMovimientos: 2 }],
      ["produccion consumption", { consumosProduccion: 1 }],
      ["missing stockLote row", { stockLoteLock: null }],
    ];
    for (const [nombre, escenario] of casos) {
      const { tx, secuencia } = crearTx(escenario);
      await rechazadoCon(
        ejecutarEdicionEntradaTx(tx, parametros({ cantidad: 4, referencia: "NUEVA" })),
        "CANTIDAD_COSTO_NO_EDITABLES"
      ).catch((e) => {
        throw new Error(`${nombre}: ${e.message}`);
      });
      assert.deepEqual(escrituras(secuencia), [], nombre);
    }
  });

  it("detects a lote touched between the precheck and the lock (TOCTOU)", async () => {
    // The locked re-read already shows a sale: stock lote quantity is below the entrada.
    const { tx, secuencia } = crearTx({
      stockLoteLock: { id: BigInt(70), cantidad: "7.500" },
      totalMovimientos: 2,
    });
    await rechazadoCon(
      ejecutarEdicionEntradaTx(tx, parametros({ cantidad: 12 })),
      "CANTIDAD_COSTO_NO_EDITABLES"
    );
    assert.deepEqual(escrituras(secuencia), []);
  });

  it("fails when the inventarioSucursal row is missing", async () => {
    const { tx, secuencia } = crearTx({ inventarioLock: null });
    await assert.rejects(
      ejecutarEdicionEntradaTx(tx, parametros({ cantidad: 4 })),
      /INVENTARIO_SUCURSAL_NOT_FOUND/
    );
    assert.deepEqual(escrituras(secuencia), []);
  });

  it("rejects a quantity that rounds to zero", async () => {
    const { tx, secuencia } = crearTx();
    await assert.rejects(
      ejecutarEdicionEntradaTx(tx, parametros({ cantidad: 0.0001 })),
      ValidationError
    );
    assert.deepEqual(escrituras(secuencia), []);
  });
});

describe("ejecutarEdicionEntradaTx - lock order", () => {
  it("takes every FOR UPDATE lock before any plain read or write, in INV order", async () => {
    const { tx, secuencia, sql } = crearTx();
    await ejecutarEdicionEntradaTx(tx, parametros({ cantidad: 4 }));

    const locks = secuencia.filter((s) => s.startsWith("lock:"));
    assert.deepEqual(locks, [
      "lock:movimientoInventario",
      "lock:lote",
      "lock:stockLoteSucursal",
      "lock:inventarioSucursal",
    ]);
    const ultimoLock = secuencia.lastIndexOf("lock:inventarioSucursal");
    assert.ok(secuencia.slice(0, ultimoLock + 1).every((s) => s.startsWith("lock:")));
    assert.equal(sql.length, 4);
    for (const texto of sql) assert.ok(texto.includes("FOR UPDATE"));
    assert.ok(secuencia.indexOf("lock:stockLoteSucursal") < secuencia.indexOf("lock:inventarioSucursal"));
  });

  it("propagates a P2002 from lote.update unchanged and writes no audit", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: "lote_item_id_codigo_lote_key" },
    });
    const { tx, secuencia } = crearTx({ falloLoteUpdate: p2002 });
    await assert.rejects(
      ejecutarEdicionEntradaTx(tx, parametros({ codigo_lote: "OTRO" })),
      (e: unknown) => e === p2002
    );
    assert.ok(!secuencia.includes("auditoriaEntrada.createMany"));
  });
});

describe("ejecutarEdicionEntradaTx - retry", () => {
  it("retries a transient failure and leaves exactly one audit insert", async () => {
    const intentos: ReturnType<typeof crearTx>[] = [];
    const cliente = {
      $transaction: async (fn: (tx: any) => Promise<unknown>) => {
        const intento = crearTx();
        intentos.push(intento);
        if (intentos.length === 1) {
          await fn(intento.tx).catch(() => undefined);
          throw Object.assign(new Error("write conflict"), { code: "P2034" });
        }
        return fn(intento.tx);
      },
    };

    const r: any = await runWithRetry(
      (tx) => ejecutarEdicionEntradaTx(tx, parametros({ cantidad: 4, costo_unit: 3 })),
      { prismaClient: cliente, sleepFn: async () => undefined, jitter: 0 }
    );

    assert.equal(intentos.length, 2);
    assert.equal(r.sinCambios, false);
    // The first attempt would be rolled back by the database; the retry
    // reproduces the same final writes and a single audit insert.
    assert.deepEqual(intentos[1].secuencia, intentos[0].secuencia);
    assert.equal(intentos[1].secuencia.filter((s) => s === "auditoriaEntrada.createMany").length, 1);
    assert.deepEqual(intentos[1].args.inventarioUpdate, intentos[0].args.inventarioUpdate);
  });
});
