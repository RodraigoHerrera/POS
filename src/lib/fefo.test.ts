import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareBigIntAsc,
  round3Decimals,
  simularConsumoFEFO,
  applySortedStockDecrements,
  applySortedStockRestorations,
  InsufficientStockError,
  LoteDisponible,
} from './fefo';
import {
  isDeadlockError,
  calculateJitteredBackoff,
  runWithRetry,
} from './transactionRetry';

// ==========================================
// 1. compareBigIntAsc Tests
// ==========================================
test('compareBigIntAsc - sorts BigInts, numbers, and numeric strings deterministically', () => {
  // Direct BigInt comparison
  assert.equal(compareBigIntAsc(BigInt(1), BigInt(2)), -1);
  assert.equal(compareBigIntAsc(BigInt(2), BigInt(1)), 1);
  assert.equal(compareBigIntAsc(BigInt(5), BigInt(5)), 0);

  // Cross-type: BigInt, string, number
  assert.equal(compareBigIntAsc('10', 20), -1);
  assert.equal(compareBigIntAsc(30, '25'), 1);
  assert.equal(compareBigIntAsc('100', BigInt(100)), 0);

  // Large 64-bit integers exceeding Number.MAX_SAFE_INTEGER
  const largeA = '9007199254740993'; // 2^53 + 1
  const largeB = '9007199254740994'; // 2^53 + 2
  assert.equal(compareBigIntAsc(largeA, largeB), -1);
  assert.equal(compareBigIntAsc(largeB, largeA), 1);

  // Array sorting verification
  const ids = ['100', '5', '50', '1', '25', '1000'];
  ids.sort((a, b) => compareBigIntAsc(a, b));
  assert.deepEqual(ids, ['1', '5', '25', '50', '100', '1000']);
});

// ==========================================
// 2. round3Decimals Tests
// ==========================================
test('round3Decimals - handles floating point precision and 3 decimal rounding', () => {
  // Classic IEEE-754 precision error
  assert.equal(0.1 + 0.2 === 0.3, false);
  assert.equal(round3Decimals(0.1 + 0.2), 0.3);

  assert.equal(round3Decimals(1.0004), 1);
  assert.equal(round3Decimals(1.0006), 1.001);
  assert.equal(round3Decimals(0.33333333), 0.333);
  assert.equal(round3Decimals(10.5), 10.5);
  assert.equal(round3Decimals(0), 0);
});

// ==========================================
// 3. simularConsumoFEFO Tests
// ==========================================
test('simularConsumoFEFO - multi-lot split across earliest expiring lots (FEFO)', () => {
  const lotesDisponibles: LoteDisponible[] = [
    {
      id: BigInt(20),
      lote_id: BigInt(2),
      cantidad: 4,
      lote: {
        item_id: BigInt(101),
        costo_unit: 12.0,
        fecha_caducidad: new Date('2026-12-31'),
      },
    },
    {
      id: BigInt(10),
      lote_id: BigInt(1),
      cantidad: 3,
      lote: {
        item_id: BigInt(101),
        costo_unit: 10.0,
        fecha_caducidad: new Date('2026-10-01'), // Earlier expiration
      },
    },
  ];

  // Request 5 units of insumo 101
  const reqs = [[{ insumoId: BigInt(101), cantidadRequerida: 5 }]];

  const result = simularConsumoFEFO(lotesDisponibles, reqs);

  // Lot 1 (expires 2026-10-01): 3 units @ 10.0 = 30.0
  // Lot 2 (expires 2026-12-31): 2 units @ 12.0 = 24.0
  // Total cost = 54.0
  assert.equal(result.costoPorItem[0], 54.0);
  assert.equal(result.insumosSinStock.length, 0);

  // Output lotDecrements must be sorted by BigInt(id) ASC (INV-1)
  assert.equal(result.lotDecrements.length, 2);
  assert.equal(result.lotDecrements[0].id, BigInt(10));
  assert.equal(result.lotDecrements[0].total, 3);
  assert.equal(result.lotDecrements[1].id, BigInt(20));
  assert.equal(result.lotDecrements[1].total, 2);

  // Output inventarioDecrements must be sorted by BigInt(item_id) ASC (INV-2)
  assert.equal(result.inventarioDecrements.length, 1);
  assert.equal(result.inventarioDecrements[0].item_id, BigInt(101));
  assert.equal(result.inventarioDecrements[0].total, 5);
});

test('simularConsumoFEFO - consolidates duplicate lot and inventory demands across items', () => {
  // Lote 50 has 10 units of beef patty (insumo 200)
  const lotesDisponibles: LoteDisponible[] = [
    {
      id: BigInt(50),
      lote_id: BigInt(5),
      cantidad: 10,
      lote: {
        item_id: BigInt(200),
        costo_unit: 5.5,
        fecha_caducidad: new Date('2026-11-15'),
      },
    },
  ];

  // Item 0 needs 2 units; Item 1 needs 3 units of the same insumo
  const reqs = [
    [{ insumoId: BigInt(200), cantidadRequerida: 2 }],
    [{ insumoId: BigInt(200), cantidadRequerida: 3 }],
  ];

  const result = simularConsumoFEFO(lotesDisponibles, reqs);

  assert.equal(result.costoPorItem[0], 11.0); // 2 * 5.5
  assert.equal(result.costoPorItem[1], 16.5); // 3 * 5.5

  // Consolidated into exactly 1 lot decrement of 5 units
  assert.equal(result.lotDecrements.length, 1);
  assert.equal(result.lotDecrements[0].id, BigInt(50));
  assert.equal(result.lotDecrements[0].total, 5);

  // Consolidated into exactly 1 inventory decrement of 5 units
  assert.equal(result.inventarioDecrements.length, 1);
  assert.equal(result.inventarioDecrements[0].item_id, BigInt(200));
  assert.equal(result.inventarioDecrements[0].total, 5);
});

test('simularConsumoFEFO - enforces deterministic lock order INV-1 and INV-2', () => {
  // Lotes defined in reverse order of IDs
  const lotesDisponibles: LoteDisponible[] = [
    {
      id: BigInt(99),
      lote_id: BigInt(9),
      cantidad: 10,
      lote: { item_id: BigInt(300), costo_unit: 1.0 },
    },
    {
      id: BigInt(12),
      lote_id: BigInt(1),
      cantidad: 10,
      lote: { item_id: BigInt(100), costo_unit: 2.0 },
    },
    {
      id: BigInt(55),
      lote_id: BigInt(5),
      cantidad: 10,
      lote: { item_id: BigInt(200), costo_unit: 3.0 },
    },
  ];

  const reqs = [
    [
      { insumoId: BigInt(300), cantidadRequerida: 1 },
      { insumoId: BigInt(100), cantidadRequerida: 1 },
      { insumoId: BigInt(200), cantidadRequerida: 1 },
    ],
  ];

  const result = simularConsumoFEFO(lotesDisponibles, reqs);

  // Check INV-1: lotDecrements strictly ascending by id
  const lotIds = result.lotDecrements.map((d) => d.id);
  assert.deepEqual(lotIds, [BigInt(12), BigInt(55), BigInt(99)]);

  // Check INV-2: inventarioDecrements strictly ascending by item_id
  const itemIds = result.inventarioDecrements.map((d) => d.item_id);
  assert.deepEqual(itemIds, [BigInt(100), BigInt(200), BigInt(300)]);
});

test('simularConsumoFEFO - shortage detection in whole-order mode', () => {
  const lotesDisponibles: LoteDisponible[] = [
    {
      id: BigInt(1),
      lote_id: BigInt(1),
      cantidad: 2,
      lote: { item_id: BigInt(50), costo_unit: 4.0 },
    },
  ];

  // Request 5 units when only 2 exist
  const reqs = [[{ insumoId: BigInt(50), cantidadRequerida: 5 }]];

  // Without throwOnShortage: records shortage
  const res = simularConsumoFEFO(lotesDisponibles, reqs);
  assert.equal(res.insumosSinStock.length, 1);
  assert.equal(res.insumosSinStock[0], BigInt(50));

  // With throwOnShortage: throws InsufficientStockError
  assert.throws(
    () => simularConsumoFEFO(lotesDisponibles, reqs, { throwOnShortage: true }),
    (err: any) => {
      assert.ok(err instanceof InsufficientStockError);
      assert.ok(err.message.startsWith('Stock insuficiente'));
      assert.deepEqual(err.insumoIds, [BigInt(50)]);
      return true;
    }
  );
});

test('simularConsumoFEFO - allowPartialDrop rolls back failed item and retains successful item', () => {
  const lotesDisponibles: LoteDisponible[] = [
    {
      id: BigInt(1),
      lote_id: BigInt(1),
      cantidad: 2,
      lote: { item_id: BigInt(10), costo_unit: 5.0 },
    },
    {
      id: BigInt(2),
      lote_id: BigInt(2),
      cantidad: 1,
      lote: { item_id: BigInt(20), costo_unit: 10.0 },
    },
  ];

  // Item 0 requires 1 unit of item 10 and 1 unit of item 20 (can be fulfilled)
  // Item 1 requires 2 units of item 20 (cannot be fulfilled: only 0 left after item 0)
  const reqs = [
    [
      { insumoId: BigInt(10), cantidadRequerida: 1 },
      { insumoId: BigInt(20), cantidadRequerida: 1 },
    ],
    [
      { insumoId: BigInt(20), cantidadRequerida: 2 },
    ],
  ];

  const result = simularConsumoFEFO(lotesDisponibles, reqs, { allowPartialDrop: true });

  assert.deepEqual(result.successfulItemsIndices, [0]);
  assert.deepEqual(result.droppedItemsIndices, [1]);
  assert.equal(result.costoPorItem[0], 15.0); // 5 + 10
  assert.equal(result.costoPorItem[1], 0);

  // Only Item 0's consumption remains
  assert.equal(result.lotDecrements.length, 2);
  assert.equal(result.lotDecrements[0].id, BigInt(1));
  assert.equal(result.lotDecrements[0].total, 1);
  assert.equal(result.lotDecrements[1].id, BigInt(2));
  assert.equal(result.lotDecrements[1].total, 1);
});

test('simularConsumoFEFO - allowPartialDrop throws if no items can be fulfilled', () => {
  const lotesDisponibles: LoteDisponible[] = [];

  const reqs = [[{ insumoId: BigInt(10), cantidadRequerida: 1 }]];

  assert.throws(
    () => simularConsumoFEFO(lotesDisponibles, reqs, { allowPartialDrop: true }),
    (err: any) => {
      assert.ok(err instanceof InsufficientStockError);
      assert.equal(err.message, 'No hay suficiente stock para preparar ningún item de esta actualización.');
      return true;
    }
  );
});

// ==========================================
// 4. isDeadlockError Tests
// ==========================================
test('isDeadlockError - identifies Prisma code P2034 and MySQL deadlock / timeout errors', () => {
  // Prisma write conflict / deadlock code
  assert.equal(isDeadlockError({ code: 'P2034', message: 'Transaction write conflict' }), true);

  // MySQL errno 1213: ER_LOCK_DEADLOCK
  assert.equal(isDeadlockError({ code: '1213', message: 'Deadlock found' }), true);
  assert.equal(isDeadlockError({ errno: 1213, message: 'Deadlock' }), true);
  assert.equal(isDeadlockError({ cause: { errno: 1213 } }), true);

  // MySQL errno 1205: ER_LOCK_WAIT_TIMEOUT
  assert.equal(isDeadlockError({ code: '1205', message: 'Lock wait timeout exceeded' }), true);
  assert.equal(isDeadlockError({ errno: 1205 }), true);
  assert.equal(isDeadlockError({ cause: { code: 'ER_LOCK_WAIT_TIMEOUT' } }), true);

  // String message match
  assert.equal(isDeadlockError(new Error('Deadlock found when trying to get lock; try restarting transaction')), true);
  assert.equal(isDeadlockError(new Error('Lock wait timeout exceeded')), true);

  // MUST reject stock insufficiency errors
  assert.equal(isDeadlockError(new Error('Stock insuficiente para preparar el pedido')), false);
  assert.equal(isDeadlockError(new Error('Stock insuficiente: otro pedido consumió el inventario simultáneamente, intenta de nuevo')), false);
  assert.equal(isDeadlockError(new Error('No hay suficiente stock para preparar ningún item de esta actualización.')), false);

  // Non-deadlock errors
  assert.equal(isDeadlockError(new Error('El carrito está vacío')), false);
  assert.equal(isDeadlockError(new Error('Syntax error in SQL')), false);
  assert.equal(isDeadlockError(null), false);
  assert.equal(isDeadlockError(undefined), false);
  assert.equal(isDeadlockError('string error'), false);
});

// ==========================================
// 5. calculateJitteredBackoff Tests
// ==========================================
test('calculateJitteredBackoff - computes exponential delay within expected bounds', () => {
  // Deterministic jitter = 0
  const d0 = calculateJitteredBackoff(0, { baseDelayMs: 50, factor: 2, jitter: 0 });
  assert.equal(d0, 50);

  const d1 = calculateJitteredBackoff(1, { baseDelayMs: 50, factor: 2, jitter: 0 });
  assert.equal(d1, 100);

  const d2 = calculateJitteredBackoff(2, { baseDelayMs: 50, factor: 2, jitter: 0 });
  assert.equal(d2, 200);

  // Randomized jitter within bounds
  for (let attempt = 0; attempt <= 3; attempt++) {
    const delay = calculateJitteredBackoff(attempt, {
      baseDelayMs: 50,
      factor: 2,
      jitterRangeMs: 15,
    });
    const base = 50 * Math.pow(2, attempt);
    assert.ok(delay >= base - 15, `delay ${delay} should be >= ${base - 15}`);
    assert.ok(delay <= base + 15, `delay ${delay} should be <= ${base + 15}`);
  }

  // Clamped by maxDelayMs
  const clamped = calculateJitteredBackoff(5, { baseDelayMs: 50, factor: 2, maxDelayMs: 300, jitter: 0 });
  assert.equal(clamped, 300);

  // Never returns negative
  const nonNegative = calculateJitteredBackoff(0, { baseDelayMs: 10, jitter: -50 });
  assert.equal(nonNegative, 0);
});

// ==========================================
// 6. runWithRetry Tests
// ==========================================
test('runWithRetry - executes successfully on first attempt without retrying', async () => {
  let executions = 0;
  const mockClient = {
    $transaction: async (fn: any) => {
      executions++;
      return fn({});
    },
  };

  const result = await runWithRetry(async () => 'OK', {
    prismaClient: mockClient,
    sleepFn: async () => {},
  });

  assert.equal(result, 'OK');
  assert.equal(executions, 1);
});

test('runWithRetry - retries on deadlock and recovers on next attempt', async () => {
  let attempts = 0;
  const retriesLog: number[] = [];

  const mockClient = {
    $transaction: async (fn: any) => {
      attempts++;
      if (attempts === 1) {
        const err = new Error('Deadlock found when trying to get lock');
        (err as any).code = 'P2034';
        throw err;
      }
      return fn({});
    },
  };

  const result = await runWithRetry(async () => 'RECOVERED', {
    prismaClient: mockClient,
    sleepFn: async () => {},
    onRetry: (_err, attempt) => {
      retriesLog.push(attempt);
    },
  });

  assert.equal(result, 'RECOVERED');
  assert.equal(attempts, 2);
  assert.deepEqual(retriesLog, [0]);
});

test('runWithRetry - fails fast on stock shortage without retrying', async () => {
  let attempts = 0;

  const mockClient = {
    $transaction: async () => {
      attempts++;
      throw new Error('Stock insuficiente: otro pedido consumió el inventario simultáneamente, intenta de nuevo');
    },
  };

  await assert.rejects(
    async () => {
      await runWithRetry(async () => {}, {
        prismaClient: mockClient,
        sleepFn: async () => {},
      });
    },
    (err: any) => {
      assert.ok(err.message.startsWith('Stock insuficiente'));
      return true;
    }
  );

  assert.equal(attempts, 1);
});

test('runWithRetry - throws after exhausting maxRetries', async () => {
  let attempts = 0;

  const mockClient = {
    $transaction: async () => {
      attempts++;
      const err = new Error('Deadlock');
      (err as any).code = '1213';
      throw err;
    },
  };

  await assert.rejects(
    async () => {
      await runWithRetry(async () => {}, {
        maxRetries: 2,
        prismaClient: mockClient,
        sleepFn: async () => {},
      });
    },
    (err: any) => {
      assert.equal(err.code, '1213');
      return true;
    }
  );

  // Initial attempt (0) + 2 retries (attempts 1 and 2) = 3 total attempts
  assert.equal(attempts, 3);
});

// ==========================================
// 7. applySortedStockDecrements Tests
// ==========================================
test('applySortedStockDecrements - executes updates in strictly ascending order and guards against concurrent depletion', async () => {
  const lotUpdateLog: bigint[] = [];
  const invUpdateLog: bigint[] = [];
  let kardexBatched: any[] = [];

  const mockTx = {
    stockLoteSucursal: {
      updateMany: async ({ where }: any) => {
        lotUpdateLog.push(where.id);
        return { count: 1 };
      },
    },
    movimientoInventario: {
      createMany: async ({ data }: any) => {
        kardexBatched = data;
        return { count: data.length };
      },
    },
    inventarioSucursal: {
      updateMany: async ({ where }: any) => {
        invUpdateLog.push(where.item_id);
        return { count: 1 };
      },
    },
  };

  // Unsorted decrements passed
  const lotDecrements = [
    { id: BigInt(50), lote_id: BigInt(5), item_id: BigInt(200), costo_unit: 10, total: 2 },
    { id: BigInt(10), lote_id: BigInt(1), item_id: BigInt(100), costo_unit: 5, total: 3 },
  ];
  const invDecrements = [
    { item_id: BigInt(200), total: 2 },
    { item_id: BigInt(100), total: 3 },
  ];

  await applySortedStockDecrements(mockTx, BigInt(1), lotDecrements, invDecrements, 'Pedido #123');

  // Must execute lot updates sorted by id ASC (INV-1)
  assert.deepEqual(lotUpdateLog, [BigInt(10), BigInt(50)]);

  // Must execute inventory updates sorted by item_id ASC (INV-2)
  assert.deepEqual(invUpdateLog, [BigInt(100), BigInt(200)]);

  // Kardex movements created
  assert.equal(kardexBatched.length, 2);
  assert.equal(kardexBatched[0].tipo, 'Salida');
  assert.equal(kardexBatched[0].referencia, 'Pedido #123');

  // Verify failure when count === 0 (concurrent depletion guard INV-4)
  const failingTx = {
    stockLoteSucursal: {
      updateMany: async () => ({ count: 0 }),
    },
  };

  await assert.rejects(
    async () => {
      await applySortedStockDecrements(failingTx, BigInt(1), lotDecrements, invDecrements, 'Pedido #123');
    },
    (err: any) => {
      assert.ok(err.message.startsWith('Stock insuficiente'));
      return true;
    }
  );
});

// ==========================================
// 8. applySortedStockRestorations Tests
// ==========================================
test('applySortedStockRestorations - restores stock deterministically sorted by lote_id ASC and item_id ASC', async () => {
  const lotUpsertLog: bigint[] = [];
  const invUpdateLog: bigint[] = [];
  let kardexBatched: any[] = [];

  const mockTx = {
    stockLoteSucursal: {
      upsert: async ({ where }: any) => {
        lotUpsertLog.push(where.sucursal_id_lote_id.lote_id);
        return {};
      },
    },
    movimientoInventario: {
      createMany: async ({ data }: any) => {
        kardexBatched = data;
        return { count: data.length };
      },
    },
    inventarioSucursal: {
      updateMany: async ({ where }: any) => {
        invUpdateLog.push(where.item_id);
        return { count: 1 };
      },
    },
  };

  // Consumptions to reverse in arbitrary order with duplicate lote_ids and item_ids
  const consumos = [
    { sucursal_id: BigInt(1), item_id: BigInt(300), lote_id: BigInt(30), cantidad: 2, costo_unit: 4 },
    { sucursal_id: BigInt(1), item_id: BigInt(100), lote_id: BigInt(10), cantidad: 1, costo_unit: 8 },
    { sucursal_id: BigInt(1), item_id: BigInt(300), lote_id: BigInt(30), cantidad: 3, costo_unit: 4 },
  ];

  await applySortedStockRestorations(mockTx, BigInt(1), consumos, 'Reversa Edición Pedido #456');

  // Lot upserts must be executed sorted by lote_id ASC (INV-1)
  assert.deepEqual(lotUpsertLog, [BigInt(10), BigInt(30)]);

  // Inventory updates must be executed sorted by item_id ASC (INV-2)
  assert.deepEqual(invUpdateLog, [BigInt(100), BigInt(300)]);

  // Kardex reversal movements created
  assert.equal(kardexBatched.length, 3);
  assert.equal(kardexBatched[0].tipo, 'Entrada');
  assert.equal(kardexBatched[0].motivo, 'Ajuste');
  assert.equal(kardexBatched[0].referencia, 'Reversa Edición Pedido #456');
});
