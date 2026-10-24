/* eslint-disable @typescript-eslint/no-explicit-any -- mocked transaction client */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runWithRetry } from "./transactionRetry";
import { AnulacionEntradaError, ejecutarAnulacionEntradaTx } from "./entradaAnulacion";

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
  anulado_en: null,
};
const loteBase = { id: LOTE, item_id: BigInt(100) };

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
      aggregate: async () => {
        secuencia.push("movimientoInventario.aggregate");
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
      findMany: async (a: unknown) => {
        secuencia.push("stockLoteSucursal.findMany");
        args.findMany = a;
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
        return { count: 1 };
      },
    },
  };
  return { tx, secuencia, sql, args };
}

const parametros = (motivo: string | null = null, sucursalId = SUCURSAL) => ({
  movimientoId: MOV,
  sucursalId,
  empleadoId: EMPLEADO,
  motivo,
});

const escrituras = (secuencia: string[]) =>
  secuencia.filter((s) => /\.(update|createMany)$/.test(s));

async function rechazadoCon(promesa: Promise<unknown>, codigo: string) {
  await assert.rejects(promesa, (e: unknown) => {
    assert.ok(e instanceof AnulacionEntradaError);
    assert.equal((e as AnulacionEntradaError).codigo, codigo);
    return true;
  });
}

describe("ejecutarAnulacionEntradaTx - eligibility", () => {
  it("rejects with 404 when the movement does not exist or is in another sucursal", async () => {
    const a = crearTx({ movimiento: null });
    await rechazadoCon(ejecutarAnulacionEntradaTx(a.tx, parametros()), "ENTRADA_NO_ENCONTRADA");
    assert.deepEqual(escrituras(a.secuencia), []);

    const b = crearTx();
    await rechazadoCon(
      ejecutarAnulacionEntradaTx(b.tx, parametros(null, BigInt(2))),
      "ENTRADA_NO_ENCONTRADA"
    );
    assert.deepEqual(escrituras(b.secuencia), []);
  });

  it("rejects non-manual movements before locking the lote", async () => {
    for (const parcial of [{ tipo: "Salida" }, { motivo: "Produccion" }, { lote_id: null }]) {
      const { tx, secuencia } = crearTx({ movimiento: { ...movimientoBase, ...parcial } });
      await rechazadoCon(ejecutarAnulacionEntradaTx(tx, parametros()), "ENTRADA_NO_ANULABLE");
      assert.deepEqual(secuencia, ["lock:movimientoInventario"]);
    }
  });

  it("rejects an already voided entry before locking the lote", async () => {
    const { tx, secuencia } = crearTx({
      movimiento: { ...movimientoBase, anulado_en: new Date("2026-10-01T00:00:00.000Z") },
    });
    await rechazadoCon(ejecutarAnulacionEntradaTx(tx, parametros()), "ENTRADA_YA_ANULADA");
    assert.deepEqual(secuencia, ["lock:movimientoInventario"]);
  });

  it("rejects touched lotes after the locks and writes nothing", async () => {
    const casos: Array<[string, Escenario]> = [
      ["stock quantity differs", { stockLoteLock: { id: BigInt(70), cantidad: "6.000" } }],
      ["extra movement", { totalMovimientos: 2 }],
      ["not the originating movement", { primerMovimientoId: BigInt(3), totalMovimientos: 2 }],
      ["produccion consumption", { consumosProduccion: 1 }],
      ["missing stockLote row", { stockLoteLock: null }],
    ];
    for (const [nombre, escenario] of casos) {
      const { tx, secuencia } = crearTx(escenario);
      await rechazadoCon(ejecutarAnulacionEntradaTx(tx, parametros()), "ENTRADA_NO_ANULABLE").catch(
        (e) => {
          throw new Error(`${nombre}: ${e.message}`);
        }
      );
      assert.deepEqual(escrituras(secuencia), [], nombre);
    }
  });

  it("fails without writes when the inventarioSucursal row is missing", async () => {
    const { tx, secuencia } = crearTx({ inventarioLock: null });
    await assert.rejects(ejecutarAnulacionEntradaTx(tx, parametros()), /INVENTARIO_SUCURSAL_NOT_FOUND/);
    assert.deepEqual(escrituras(secuencia), []);
  });

  it("rejects when inventory stock is lower than the entry quantity", async () => {
    const { tx, secuencia } = crearTx({
      inventarioLock: { id: BigInt(90), stock: "4.000", costo_promedio: "3.000000" },
    });
    await rechazadoCon(ejecutarAnulacionEntradaTx(tx, parametros()), "ENTRADA_NO_ANULABLE");
    assert.deepEqual(escrituras(secuencia), []);
  });
});

describe("ejecutarAnulacionEntradaTx - void", () => {
  it("reverts stock and average cost, marks the movement and writes one audit row", async () => {
    const { tx, secuencia, args } = crearTx();
    const r = await ejecutarAnulacionEntradaTx(tx, parametros("Error de digitación"));

    assert.deepEqual(secuencia, [
      "lock:movimientoInventario",
      "lock:lote",
      "lock:stockLoteSucursal",
      "lock:inventarioSucursal",
      "movimientoInventario.aggregate",
      "produccionItem.count",
      "stockLoteSucursal.findMany",
      "stockLoteSucursal.update",
      "inventarioSucursal.update",
      "movimientoInventario.update",
      "auditoriaEntrada.createMany",
    ]);
    assert.deepEqual(args.stockLoteUpdate, { where: { id: BigInt(70) }, data: { cantidad: 0 } });
    // stock = 25 - 10; costo = (15 * 4) / 15 = 4 (the voided lote is excluded)
    assert.deepEqual(args.inventarioUpdate, {
      where: { id: BigInt(90) },
      data: { stock: 15, costo_promedio: 4 },
    });
    assert.deepEqual(r, { inventario: { stock: 15, costo_promedio: 4 } });
    assert.equal(args.movimientoUpdate.where.id, MOV);
    assert.ok(args.movimientoUpdate.data.anulado_en instanceof Date);
    assert.equal(args.auditoria.data.length, 1);
    assert.deepEqual(args.auditoria.data[0], {
      movimiento_id: MOV,
      lote_id: LOTE,
      sucursal_id: SUCURSAL,
      empleado_id: EMPLEADO,
      campo: "anulacion",
      valor_anterior: "10.000",
      valor_nuevo: "Error de digitación",
    });
  });

  it("stores a null reason when none is given", async () => {
    const { tx, args } = crearTx();
    await ejecutarAnulacionEntradaTx(tx, parametros(null));
    assert.equal(args.auditoria.data[0].valor_nuevo, null);
  });

  it("keeps the previous average cost when no stock remains", async () => {
    const { tx, args } = crearTx({
      inventarioLock: { id: BigInt(90), stock: "10.000", costo_promedio: "2.500000" },
      lotesItem: [{ lote_id: LOTE, cantidad: "10.000", lote: { costo_unit: "2.000000" } }],
    });
    await ejecutarAnulacionEntradaTx(tx, parametros());
    assert.deepEqual(args.inventarioUpdate.data, { stock: 0, costo_promedio: 2.5 });
  });
});

describe("ejecutarAnulacionEntradaTx - lock order", () => {
  it("takes every FOR UPDATE lock before any plain read or write, in order", async () => {
    const { tx, secuencia, sql } = crearTx();
    await ejecutarAnulacionEntradaTx(tx, parametros());

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
  });
});

describe("ejecutarAnulacionEntradaTx - retry", () => {
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

    await runWithRetry((tx) => ejecutarAnulacionEntradaTx(tx, parametros("x")), {
      prismaClient: cliente,
      sleepFn: async () => undefined,
      jitter: 0,
    });

    assert.equal(intentos.length, 2);
    assert.deepEqual(intentos[1].secuencia, intentos[0].secuencia);
    assert.equal(intentos[1].secuencia.filter((s) => s === "auditoriaEntrada.createMany").length, 1);
  });
});
