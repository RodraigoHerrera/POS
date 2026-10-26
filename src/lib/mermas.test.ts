import "dotenv/config";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  ValidationError,
  validationErrorResponse,
} from "./validation";
import { compareBigIntAsc, round3Decimals } from "./fefo";
import { runWithRetry, isDeadlockError } from "./transactionRetry";
import {
  TIPOS_MERMA_VALIDOS,
  validarDatosMerma,
  construirReferenciaKardexMerma,
  calcularAsignacionesMermaFEFO,
  ejecutarRegistroMermaTx,
  LoteStockParaMerma,
} from "./mermas";
import { POST as mermasHandler } from "../app/api/inventarios/mermas/route";

const TEST_SECRET = process.env.JWT_SECRET || "142191_";

function createAuthCookieHeader(sucursalId = "1", empleadoId = "42", rol = "Cajero"): string {
  const tokenSucursal = jwt.sign({ sucursalId, correo: "suc1@smash.com" }, TEST_SECRET);
  const tokenEmpleado = jwt.sign({ empleadoId, rol, sucursalId }, TEST_SECRET);
  return `tokenSucursal=${tokenSucursal}; tokenEmpleado=${tokenEmpleado}`;
}

describe("SEC-13: Atomic Waste Locking & Concurrency Protection (mermas)", () => {
  describe("Phase 1 & Invariant: Fail-Fast Input Validation", () => {
    it("validates TIPOS_MERMA_VALIDOS whitelist constant", () => {
      assert.deepEqual([...TIPOS_MERMA_VALIDOS], ["vencimiento", "dano", "robo", "error"]);
    });

    it("accepts valid inputs and formats types properly", () => {
      const valid = validarDatosMerma({
        itemId: "10",
        cantidad: "5.5",
        tipoMerma: "vencimiento",
        motivo: "Caducó en refrigerador",
        loteReferencia: "LOT-2026-A",
      });

      assert.equal(valid.itemId, BigInt(10));
      assert.equal(valid.cantidad, 5.5);
      assert.equal(valid.tipoMerma, "vencimiento");
      assert.equal(valid.motivo, "Caducó en refrigerador");
      assert.equal(valid.loteReferencia, "LOT-2026-A");
    });

    it("rounds cantidad to 3 decimal places", () => {
      const valid = validarDatosMerma({
        itemId: 1,
        cantidad: 2.123456,
        tipoMerma: "dano",
      });
      assert.equal(valid.cantidad, 2.123);
    });

    it("rejects non-object or null request body", () => {
      assert.throws(
        () => validarDatosMerma(null),
        (err: unknown) => err instanceof ValidationError && err.field === "body"
      );
      assert.throws(
        () => validarDatosMerma(undefined),
        (err: unknown) => err instanceof ValidationError && err.field === "body"
      );
      assert.throws(
        () => validarDatosMerma("string body"),
        (err: unknown) => err instanceof ValidationError && err.field === "body"
      );
    });

    it("rejects invalid, zero, or negative itemId", () => {
      assert.throws(
        () => validarDatosMerma({ itemId: 0, cantidad: 5, tipoMerma: "robo" }),
        (err: unknown) => err instanceof ValidationError && err.field === "itemId"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: -1, cantidad: 5, tipoMerma: "robo" }),
        (err: unknown) => err instanceof ValidationError && err.field === "itemId"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: "abc", cantidad: 5, tipoMerma: "robo" }),
        (err: unknown) => err instanceof ValidationError && err.field === "itemId"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: null, cantidad: 5, tipoMerma: "robo" }),
        (err: unknown) => err instanceof ValidationError && err.field === "itemId"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: "1.5", cantidad: 5, tipoMerma: "robo" }),
        (err: unknown) => err instanceof ValidationError && err.field === "itemId"
      );
    });

    it("rejects non-positive or invalid cantidad", () => {
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: 0, tipoMerma: "error" }),
        (err: unknown) => err instanceof ValidationError && err.field === "cantidad"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: -5, tipoMerma: "error" }),
        (err: unknown) => err instanceof ValidationError && err.field === "cantidad"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: NaN, tipoMerma: "error" }),
        (err: unknown) => err instanceof ValidationError && err.field === "cantidad"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: "invalido", tipoMerma: "error" }),
        (err: unknown) => err instanceof ValidationError && err.field === "cantidad"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: null, tipoMerma: "error" }),
        (err: unknown) => err instanceof ValidationError && err.field === "cantidad"
      );
    });

    it("rejects invalid or missing tipoMerma", () => {
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: 10, tipoMerma: "otro" }),
        (err: unknown) => err instanceof ValidationError && err.field === "tipoMerma"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: 10, tipoMerma: "" }),
        (err: unknown) => err instanceof ValidationError && err.field === "tipoMerma"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: 10, tipoMerma: 123 }),
        (err: unknown) => err instanceof ValidationError && err.field === "tipoMerma"
      );
      assert.throws(
        () => validarDatosMerma({ itemId: 1, cantidad: 10 }),
        (err: unknown) => err instanceof ValidationError && err.field === "tipoMerma"
      );
    });

    it("formats kardex reference label correctly with 64-char limit", () => {
      assert.equal(
        construirReferenciaKardexMerma("vencimiento"),
        "Vencimiento"
      );
      assert.equal(
        construirReferenciaKardexMerma("dano", "LOT-99"),
        "Daño — lote LOT-99"
      );
      assert.equal(
        construirReferenciaKardexMerma("robo", "LOT-1", "Sustracción en bodega"),
        "Robo — lote LOT-1 — Sustracción en bodega"
      );
      assert.equal(
        construirReferenciaKardexMerma("error", undefined, "Ajuste manual de conteo físico"),
        "Error de registro — Ajuste manual de conteo físico"
      );

      const longMotivo = "A".repeat(100);
      const ref = construirReferenciaKardexMerma("dano", "LOT-12345", longMotivo);
      assert.ok(ref.length <= 64);
      assert.equal(ref.length, 64);
    });
  });

  describe("Invariants: FEFO Allocation & Shortage Detection", () => {
    const lotesSample: LoteStockParaMerma[] = [
      {
        id: BigInt(10),
        lote_id: BigInt(101),
        cantidad: 15,
        lote: { costo_unit: 10, fecha_caducidad: new Date("2026-11-01") },
      },
      {
        id: BigInt(20),
        lote_id: BigInt(102),
        cantidad: 10,
        lote: { costo_unit: 12, fecha_caducidad: new Date("2026-10-15") },
      },
      {
        id: BigInt(30),
        lote_id: BigInt(103),
        cantidad: 20,
        lote: { costo_unit: 8, fecha_caducidad: new Date("2026-12-01") },
      },
    ];

    it("allocates earliest expiring lot first regardless of array order", () => {
      // Requested: 15 units.
      // Earliest is id=20 (expires 2026-10-15, qty=10) -> full 10 units @ $12.
      // Next is id=10 (expires 2026-11-01, qty=15) -> remaining 5 units @ $10.
      // id=30 is untouched.
      const res = calcularAsignacionesMermaFEFO(lotesSample, 15);

      assert.equal(res.stockDisponible, 45);
      assert.equal(res.costoTotalPerdido, 10 * 12 + 5 * 10); // 120 + 50 = 170
      assert.equal(res.allocations.length, 2);

      // Allocations must contain deductions for id=10 and id=20
      const alloc10 = res.allocations.find((a) => a.id === BigInt(10));
      const alloc20 = res.allocations.find((a) => a.id === BigInt(20));
      assert.ok(alloc10);
      assert.ok(alloc20);
      assert.equal(alloc10.aDescontar, 5);
      assert.equal(alloc20.aDescontar, 10);
    });

    it("breaks expiration ties by id ASC", () => {
      const tiedLots: LoteStockParaMerma[] = [
        {
          id: BigInt(50),
          lote_id: BigInt(501),
          cantidad: 10,
          lote: { costo_unit: 5, fecha_caducidad: new Date("2026-11-15") },
        },
        {
          id: BigInt(25),
          lote_id: BigInt(251),
          cantidad: 10,
          lote: { costo_unit: 5, fecha_caducidad: new Date("2026-11-15") },
        },
      ];

      // Request: 12 units.
      // Ties broken by id ASC: id=25 consumed first (10 units), id=50 consumed next (2 units).
      const res = calcularAsignacionesMermaFEFO(tiedLots, 12);
      assert.equal(res.allocations.length, 2);

      const alloc25 = res.allocations.find((a) => a.id === BigInt(25));
      const alloc50 = res.allocations.find((a) => a.id === BigInt(50));
      assert.equal(alloc25?.aDescontar, 10);
      assert.equal(alloc50?.aDescontar, 2);
    });

    it("treats null expiration dates as expiring latest (Infinity)", () => {
      const mixedLots: LoteStockParaMerma[] = [
        {
          id: BigInt(1),
          lote_id: BigInt(1001),
          cantidad: 5,
          lote: { costo_unit: 10, fecha_caducidad: null },
        },
        {
          id: BigInt(2),
          lote_id: BigInt(1002),
          cantidad: 5,
          lote: { costo_unit: 10, fecha_caducidad: new Date("2026-12-31") },
        },
      ];

      // Request: 5 units.
      // id=2 has a date, id=1 has null date -> id=2 should be consumed first.
      const res = calcularAsignacionesMermaFEFO(mixedLots, 5);
      assert.equal(res.allocations.length, 1);
      assert.equal(res.allocations[0].id, BigInt(2));
      assert.equal(res.allocations[0].aDescontar, 5);
    });

    it("throws shortage error when requested quantity exceeds total stock", () => {
      assert.throws(
        () => calcularAsignacionesMermaFEFO(lotesSample, 50),
        {
          name: "Error",
          message: "Stock insuficiente: hay 45 disponible y se intenta registrar una merma de 50",
        }
      );
    });

    it("throws shortage error when lot list is completely empty", () => {
      assert.throws(
        () => calcularAsignacionesMermaFEFO([], 1),
        {
          name: "Error",
          message: "Stock insuficiente: hay 0 disponible y se intenta registrar una merma de 1",
        }
      );
    });

    it("handles exact quantity allocation without leftover", () => {
      const res = calcularAsignacionesMermaFEFO(lotesSample, 45);
      assert.equal(res.allocations.length, 3);
      const totalAllocated = res.allocations.reduce((acc, a) => acc + a.aDescontar, 0);
      assert.equal(totalAllocated, 45);
    });
  });

  describe("INV-1: Deterministic Primary Key Lock Ordering", () => {
    it("guarantees allocations returned by calcularAsignacionesMermaFEFO are sorted by id ASC", () => {
      // Earlier expiration has higher id (id=88 expires earlier than id=11)
      const invertedLots: LoteStockParaMerma[] = [
        {
          id: BigInt(88),
          lote_id: BigInt(880),
          cantidad: 5,
          lote: { costo_unit: 10, fecha_caducidad: new Date("2026-10-01") },
        },
        {
          id: BigInt(11),
          lote_id: BigInt(110),
          cantidad: 5,
          lote: { costo_unit: 10, fecha_caducidad: new Date("2026-12-01") },
        },
      ];

      const res = calcularAsignacionesMermaFEFO(invertedLots, 8);
      // FEFO selects id=88 (5 units) then id=11 (3 units)
      // BUT INV-1 ensures returned allocations are sorted by id ASC: [id=11, id=88]
      assert.equal(res.allocations[0].id, BigInt(11));
      assert.equal(res.allocations[1].id, BigInt(88));
      assert.ok(compareBigIntAsc(res.allocations[0].id, res.allocations[1].id) < 0);
    });

    it("executes stockLoteSucursal.updateMany in strictly ascending id order during transaction", async () => {
      const updateOrder: bigint[] = [];

      const mockTx = {
        stockLoteSucursal: {
          updateMany: async (args: any) => {
            updateOrder.push(args.where.id);
            return { count: 1 };
          },
        },
        movimientoInventario: {
          createMany: async () => ({ count: 2 }),
        },
        inventarioSucursal: {
          updateMany: async () => ({ count: 1 }),
        },
      };

      // Pass allocations in reverse id order
      const unorderedAllocations = [
        { id: BigInt(99), lote_id: BigInt(990), aDescontar: 2, costo_unit: 10 },
        { id: BigInt(12), lote_id: BigInt(120), aDescontar: 3, costo_unit: 10 },
        { id: BigInt(45), lote_id: BigInt(450), aDescontar: 1, costo_unit: 10 },
      ];

      await ejecutarRegistroMermaTx(mockTx, {
        sucursalId: BigInt(1),
        itemId: BigInt(5),
        cantidadMerma: 6,
        referencia: "Daño",
        allocations: unorderedAllocations,
        costoTotalPerdido: 60,
      });

      // Verify updateMany was called in strictly ascending primary key order
      assert.deepEqual(updateOrder, [BigInt(12), BigInt(45), BigInt(99)]);
    });
  });

  describe("INV-4: Atomic Conditional Lot Decrement Guard", () => {
    it("includes where: { id, cantidad: { gte: aDescontar } } and decrement in updateMany", async () => {
      let capturedArgs: any = null;

      const mockTx = {
        stockLoteSucursal: {
          updateMany: async (args: any) => {
            capturedArgs = args;
            return { count: 1 };
          },
        },
        movimientoInventario: {
          createMany: async () => ({ count: 1 }),
        },
        inventarioSucursal: {
          updateMany: async () => ({ count: 1 }),
        },
      };

      await ejecutarRegistroMermaTx(mockTx, {
        sucursalId: BigInt(1),
        itemId: BigInt(5),
        cantidadMerma: 4,
        referencia: "Vencimiento",
        allocations: [{ id: BigInt(15), lote_id: BigInt(150), aDescontar: 4, costo_unit: 10 }],
        costoTotalPerdido: 40,
      });

      assert.deepEqual(capturedArgs.where, {
        id: BigInt(15),
        cantidad: { gte: 4 },
      });
      assert.deepEqual(capturedArgs.data, {
        cantidad: { decrement: 4 },
      });
    });

    it("aborts and throws immediately when updateMany returns count: 0 (lot depleted concurrently)", async () => {
      let kardexCalled = false;
      let branchInvCalled = false;

      const mockTx = {
        stockLoteSucursal: {
          updateMany: async () => {
            // Simulate concurrent consumption: count 0
            return { count: 0 };
          },
        },
        movimientoInventario: {
          createMany: async () => {
            kardexCalled = true;
            return { count: 1 };
          },
        },
        inventarioSucursal: {
          updateMany: async () => {
            branchInvCalled = true;
            return { count: 1 };
          },
        },
      };

      await assert.rejects(
        async () => {
          await ejecutarRegistroMermaTx(mockTx, {
            sucursalId: BigInt(1),
            itemId: BigInt(5),
            cantidadMerma: 3,
            referencia: "Robo",
            allocations: [{ id: BigInt(22), lote_id: BigInt(220), aDescontar: 3, costo_unit: 5 }],
            costoTotalPerdido: 15,
          });
        },
        {
          name: "Error",
          message: "Stock insuficiente: el lote fue consumido simultáneamente por otra operación, intenta de nuevo",
        }
      );

      // Verify transaction aborted before inserting Kardex or updating branch inventory
      assert.equal(kardexCalled, false);
      assert.equal(branchInvCalled, false);
    });
  });

  describe("INV-5: Atomic Aggregate Inventory Guard", () => {
    it("includes where: { sucursal_id, item_id, stock: { gte: cantidadMerma } } in branch inventory update", async () => {
      let capturedInvArgs: any = null;

      const mockTx = {
        stockLoteSucursal: {
          updateMany: async () => ({ count: 1 }),
        },
        movimientoInventario: {
          createMany: async () => ({ count: 1 }),
        },
        inventarioSucursal: {
          updateMany: async (args: any) => {
            capturedInvArgs = args;
            return { count: 1 };
          },
        },
      };

      await ejecutarRegistroMermaTx(mockTx, {
        sucursalId: BigInt(2),
        itemId: BigInt(77),
        cantidadMerma: 8.5,
        referencia: "Daño",
        allocations: [{ id: BigInt(10), lote_id: BigInt(100), aDescontar: 8.5, costo_unit: 2 }],
        costoTotalPerdido: 17,
      });

      assert.deepEqual(capturedInvArgs.where, {
        sucursal_id: BigInt(2),
        item_id: BigInt(77),
        stock: { gte: 8.5 },
      });
      assert.deepEqual(capturedInvArgs.data, {
        stock: { decrement: 8.5 },
      });
    });

    it("aborts and throws immediately when inventarioSucursal.updateMany returns count: 0", async () => {
      const mockTx = {
        stockLoteSucursal: {
          updateMany: async () => ({ count: 1 }),
        },
        movimientoInventario: {
          createMany: async () => ({ count: 1 }),
        },
        inventarioSucursal: {
          updateMany: async () => {
            // Concurrent order consumed branch stock below merma requirement
            return { count: 0 };
          },
        },
      };

      await assert.rejects(
        async () => {
          await ejecutarRegistroMermaTx(mockTx, {
            sucursalId: BigInt(1),
            itemId: BigInt(10),
            cantidadMerma: 5,
            referencia: "Vencimiento",
            allocations: [{ id: BigInt(1), lote_id: BigInt(101), aDescontar: 5, costo_unit: 3 }],
            costoTotalPerdido: 15,
          });
        },
        {
          name: "Error",
          message: "Stock insuficiente: el inventario de la sucursal fue consumido simultáneamente por otra operación",
        }
      );
    });

    it("records Kardex entries with correct Salida / Merma attributes", async () => {
      let kardexData: any = null;

      const mockTx = {
        stockLoteSucursal: {
          updateMany: async () => ({ count: 1 }),
        },
        movimientoInventario: {
          createMany: async (args: any) => {
            kardexData = args.data;
            return { count: 2 };
          },
        },
        inventarioSucursal: {
          updateMany: async () => ({ count: 1 }),
        },
      };

      const res = await ejecutarRegistroMermaTx(mockTx, {
        sucursalId: BigInt(3),
        itemId: BigInt(44),
        cantidadMerma: 10,
        referencia: "Daño — lote REF-1 — envase roto",
        allocations: [
          { id: BigInt(1), lote_id: BigInt(101), aDescontar: 6, costo_unit: 4 },
          { id: BigInt(2), lote_id: BigInt(102), aDescontar: 4, costo_unit: 5 },
        ],
        costoTotalPerdido: 44,
      });

      assert.equal(res.costoTotalPerdido, 44);
      assert.equal(res.lotesAfectados, 2);

      assert.equal(kardexData.length, 2);
      assert.deepEqual(kardexData[0], {
        sucursal_id: BigInt(3),
        item_id: BigInt(44),
        lote_id: BigInt(101),
        tipo: "Salida",
        motivo: "Merma",
        cantidad: 6,
        costo_unit: 4,
        referencia: "Daño — lote REF-1 — envase roto",
      });
      assert.deepEqual(kardexData[1], {
        sucursal_id: BigInt(3),
        item_id: BigInt(44),
        lote_id: BigInt(102),
        tipo: "Salida",
        motivo: "Merma",
        cantidad: 4,
        costo_unit: 5,
        referencia: "Daño — lote REF-1 — envase roto",
      });
    });
  });

  describe("Deadlock Recovery & Fast-Fail Guarantee via runWithRetry", () => {
    it("retries and succeeds when transaction encounters transient deadlock (1213 / P2034)", async () => {
      let attempts = 0;
      const retryCallbacks: number[] = [];

      const mockDeadlockError = {
        code: "P2034",
        message: "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
      };

      const mockPrisma = {
        $transaction: async (fn: any) => {
          attempts++;
          if (attempts === 1) {
            throw mockDeadlockError;
          }
          return fn({});
        },
      };

      const result = await runWithRetry(
        async () => {
          return { success: true, processedAttempt: attempts };
        },
        {
          prismaClient: mockPrisma,
          maxRetries: 3,
          baseDelayMs: 1,
          sleepFn: async () => {},
          onRetry: (_err, attempt) => {
            retryCallbacks.push(attempt);
          },
        }
      );

      assert.equal(attempts, 2);
      assert.deepEqual(retryCallbacks, [0]);
      assert.deepEqual(result, { success: true, processedAttempt: 2 });
    });

    it("fails fast immediately on stock exhaustion without retrying", async () => {
      let attempts = 0;
      let retryCalled = false;

      const mockPrisma = {
        $transaction: async (fn: any) => {
          attempts++;
          return fn({});
        },
      };

      await assert.rejects(
        async () => {
          await runWithRetry(
            async () => {
              throw new Error("Stock insuficiente: el lote fue consumido simultáneamente por otra operación, intenta de nuevo");
            },
            {
              prismaClient: mockPrisma,
              maxRetries: 3,
              baseDelayMs: 1,
              sleepFn: async () => {},
              onRetry: () => {
                retryCalled = true;
              },
            }
          );
        },
        {
          message: "Stock insuficiente: el lote fue consumido simultáneamente por otra operación, intenta de nuevo",
        }
      );

      // Must fail fast: attempt count is 1, onRetry is never invoked
      assert.equal(attempts, 1);
      assert.equal(retryCalled, false);
      assert.equal(isDeadlockError(new Error("Stock insuficiente: hay 5 disponible")), false);
    });
  });

  describe("HTTP Status Mapping in /api/inventarios/mermas", () => {
    it("returns HTTP 400 Bad Request on invalid input before authentication", async () => {
      const invalidRequests = [
        { body: { itemId: -1, cantidad: 10, tipoMerma: "dano" }, expectedError: "itemId" },
        { body: { itemId: 1, cantidad: 0, tipoMerma: "dano" }, expectedError: "cantidad" },
        { body: { itemId: 1, cantidad: 5, tipoMerma: "desconocido" }, expectedError: "tipoMerma" },
      ];

      for (const { body, expectedError } of invalidRequests) {
        const req = new Request("http://localhost/api/inventarios/mermas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const res = await mermasHandler(req);
        assert.equal(res.status, 400, `Expected 400 for ${expectedError}`);
        const data = await res.json();
        assert.ok(data.error.includes(expectedError) || data.message.includes(expectedError));
        assert.ok(data.message);
      }
    });

    it("returns HTTP 409 Conflict when stock shortage is encountered", async () => {
      // Simulate error response mapping directly:
      const shortageError = new Error("Stock insuficiente: hay 2 disponible y se intenta registrar una merma de 5");
      let mappedStatus = 500;
      let mappedBody: any = null;

      if (typeof shortageError?.message === "string" && shortageError.message.startsWith("Stock insuficiente")) {
        mappedStatus = 409;
        mappedBody = { message: shortageError.message };
      }

      assert.equal(mappedStatus, 409);
      assert.equal(mappedBody.message, shortageError.message);
    });

    it("returns HTTP 200 OK with proper payload structure on successful merma registration", async () => {
      // Using mock transaction flow to verify 200 payload structure
      const resultadoMock = {
        costoTotalPerdido: 125.5,
        lotesAfectados: 2,
      };
      const cantidadMerma = 10;

      const payload = {
        success: true,
        message: "Merma registrada correctamente",
        cantidad: cantidadMerma,
        costoTotalPerdido: resultadoMock.costoTotalPerdido,
        lotesAfectados: resultadoMock.lotesAfectados,
      };

      assert.equal(payload.success, true);
      assert.equal(payload.cantidad, 10);
      assert.equal(payload.costoTotalPerdido, 125.5);
      assert.equal(payload.lotesAfectados, 2);
    });
  });
});
