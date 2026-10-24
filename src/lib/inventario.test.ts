import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  round6Decimals,
  calcularNuevoCostoPromedio,
  actualizarInventarioEntrada,
} from './inventario';
import { isDeadlockError } from './transactionRetry';

describe('SEC-05: Weighted Average Cost & Inventory Intake Concurrency', () => {

  describe('round6Decimals', () => {
    it('rounds to at most 6 decimal places', () => {
      assert.equal(round6Decimals(1.0000004), 1);
      assert.equal(round6Decimals(0.0000004), 0);
      assert.equal(round6Decimals(2), 2);
      assert.equal(round6Decimals(5), 5);
      assert.equal(round6Decimals(0), 0);
    });

    it('resolves floating point boundary values accurately', () => {
      // Classic IEEE-754 precision check
      assert.equal(round6Decimals(0.1 + 0.2), 0.3);
      assert.equal(round6Decimals(1 / 3), 0.333333);
      assert.equal(round6Decimals(2 / 3), 0.666667);
    });

    it('follows toFixed behavior on binary-inexact ties (observed values)', () => {
      // Observed: these ties fall below the midpoint in binary, so they round down.
      assert.equal(round6Decimals(0.0000005), 0);
      assert.equal(round6Decimals(0.1234565), 0.123456);
      assert.equal(round6Decimals(10.1234565), 10.123456);
    });
  });

  describe('calcularNuevoCostoPromedio', () => {
    it('computes symmetrical weighted average accurately', () => {
      // 10 units @ $10 + 10 units @ $20 = 20 units @ $15
      const nuevoCosto = calcularNuevoCostoPromedio(10, 10, 10, 20);
      assert.equal(nuevoCosto, 15);
    });

    it('computes asymmetrical quantities and fractional costs', () => {
      // 10 units @ 15.5 + 20 units @ 18.25 = 520 / 30 = 17.333333... -> 17.333333
      const cost1 = calcularNuevoCostoPromedio(10, 15.5, 20, 18.25);
      assert.equal(cost1, 17.333333);

      // 3.5 units @ 12.3456 + 1.5 units @ 20.9876 = 74.691 / 5 = 14.9382
      const cost2 = calcularNuevoCostoPromedio(3.5, 12.3456, 1.5, 20.9876);
      assert.equal(cost2, 14.9382);
    });

    it('preserves per-gram costs at 6 decimals', () => {
      // Observed: 5.27 / 1500 = 0.0035133... -> 0.003513
      assert.equal(calcularNuevoCostoPromedio(1000, 0.00347, 500, 0.0036), 0.003513);
      // Reset path keeps 0.00347 (not rounded to 0.0035)
      assert.equal(calcularNuevoCostoPromedio(0, 0, 1000, 0.00347), 0.00347);
    });

    it('handles zero-cost promotional intake (donations / bonuses)', () => {
      // 10 units @ $50 + 10 units @ $0 (free/promo) = 500 / 20 = $25
      const nuevoCosto = calcularNuevoCostoPromedio(10, 50, 10, 0);
      assert.equal(nuevoCosto, 25);
    });

    it('resets cost to intake cost when stockActual = 0', () => {
      // Initial zero stock, new intake cost should become the average cost directly
      const nuevoCosto = calcularNuevoCostoPromedio(0, 50, 10, 25.5);
      assert.equal(nuevoCosto, 25.5);
    });

    it('resets cost to intake cost when stockActual < 0 (negative stock reset)', () => {
      // Negative stock anomaly reset
      const nuevoCosto = calcularNuevoCostoPromedio(-5, 100, 10, 30.1234);
      assert.equal(nuevoCosto, 30.1234);
    });

    it('resets cost to intake cost when cumulative stock is non-positive (stockActual + qtyEntrada <= 0)', () => {
      const nuevoCosto1 = calcularNuevoCostoPromedio(5, 50, -5, 42.5);
      assert.equal(nuevoCosto1, 42.5);

      const nuevoCosto2 = calcularNuevoCostoPromedio(5, 50, -10, 42.5);
      assert.equal(nuevoCosto2, 42.5);
    });
  });

  describe('actualizarInventarioEntrada', () => {
    it('executes upsert -> $queryRaw FOR UPDATE -> update in strictly sequential order', async () => {
      const callSequence: string[] = [];
      let upsertArgs: any = null;
      let rawQueryText = '';
      let updateArgs: any = null;

      const mockTx: any = {
        inventarioSucursal: {
          upsert: async (args: any) => {
            callSequence.push('upsert');
            upsertArgs = args;
            return {};
          },
          update: async (args: any) => {
            callSequence.push('update');
            updateArgs = args;
            return { id: args.where.id, ...args.data };
          },
        },
        $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
          callSequence.push('queryRaw');
          rawQueryText = strings.join('?');
          return [
            {
              id: BigInt(42),
              stock: 10,
              costo_promedio: 20,
            },
          ];
        },
      };

      const sucursalId = '1';
      const itemId = '100';
      const qtyEntrada = 10;
      const costoEntrada = 30;

      const result = await actualizarInventarioEntrada(
        mockTx,
        sucursalId,
        itemId,
        qtyEntrada,
        costoEntrada
      );

      // Verify strict execution sequence
      assert.deepEqual(callSequence, ['upsert', 'queryRaw', 'update']);

      // Verify upsert args ensure physical row existence
      assert.deepEqual(upsertArgs.where.sucursal_id_item_id, {
        sucursal_id: BigInt(1),
        item_id: BigInt(100),
      });
      assert.deepEqual(upsertArgs.create, {
        sucursal_id: BigInt(1),
        item_id: BigInt(100),
        stock: 0,
        costo_promedio: 0,
      });
      assert.deepEqual(upsertArgs.update, {});

      // Verify FOR UPDATE pessimistic lock
      assert.ok(rawQueryText.includes('FOR UPDATE'));
      assert.ok(rawQueryText.includes('`inventarioSucursal`'));

      // Verify update computed values: (10*20 + 10*30) / 20 = 25
      assert.equal(updateArgs.where.id, BigInt(42));
      assert.equal(updateArgs.data.stock, 20);
      assert.equal(updateArgs.data.costo_promedio, 25);
      assert.equal(result.stock, 20);
      assert.equal(result.costo_promedio, 25);
    });

    it('computes weighted average from locked row state on existing stock (including string/Decimal casting)', async () => {
      const mockTx: any = {
        inventarioSucursal: {
          upsert: async () => ({}),
          update: async ({ data }: any) => data,
        },
        $queryRaw: async () => [
          {
            id: BigInt(77),
            stock: '15.500', // Mock MySQL Decimal serialized as string
            costo_promedio: { toString: () => '10.2500' }, // Mock Prisma Decimal instance
          },
        ],
      };

      // 15.5 units @ 10.25 + 4.5 units @ 20.5
      // Total value: (15.5 * 10.25) + (4.5 * 20.5) = 158.875 + 92.25 = 251.125
      // Total stock: 20
      // New average cost: 251.125 / 20 = 12.55625 (kept at 6 decimals)
      const result = await actualizarInventarioEntrada(
        mockTx,
        BigInt(1),
        BigInt(200),
        4.5,
        20.5
      );

      assert.equal(result.stock, 20);
      assert.equal(result.costo_promedio, 12.55625);
    });

    it('rejects if locked query returns empty array', async () => {
      const mockTx: any = {
        inventarioSucursal: {
          upsert: async () => ({}),
          update: async () => ({}),
        },
        $queryRaw: async () => [],
      };

      await assert.rejects(
        async () => {
          await actualizarInventarioEntrada(mockTx, 1, 2, 5, 10);
        },
        { message: 'INVENTARIO_SUCURSAL_NOT_FOUND' }
      );
    });
  });

  describe('Deadlock error detection (isDeadlockError)', () => {
    it('detects MySQL deadlock and lock wait timeout errors for retry', () => {
      assert.equal(isDeadlockError({ code: 'P2034' }), true);
      assert.equal(isDeadlockError({ code: 1213 }), true);
      assert.equal(isDeadlockError({ code: '1213' }), true);
      assert.equal(isDeadlockError({ errno: 1213 }), true);
      assert.equal(isDeadlockError({ code: 1205 }), true);
      assert.equal(isDeadlockError({ errno: 1205 }), true);
      assert.equal(isDeadlockError({ cause: { code: 'ER_LOCK_DEADLOCK' } }), true);
      assert.equal(isDeadlockError({ cause: { code: 'ER_LOCK_WAIT_TIMEOUT' } }), true);
      assert.equal(
        isDeadlockError(new Error('Deadlock found when trying to get lock; try restarting transaction')),
        true
      );
      assert.equal(isDeadlockError(new Error('Lock wait timeout exceeded')), true);
    });

    it('rejects business errors from being flagged as deadlocks (fail fast)', () => {
      assert.equal(isDeadlockError(new Error('Stock insuficiente')), false);
      assert.equal(isDeadlockError(new Error('No hay suficiente stock')), false);
      assert.equal(isDeadlockError(new Error('INVENTARIO_SUCURSAL_NOT_FOUND')), false);
      assert.equal(isDeadlockError(null), false);
      assert.equal(isDeadlockError(undefined), false);
    });
  });

});
