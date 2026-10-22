import { test } from 'node:test';
import assert from 'node:assert';
import { calculateFEFODeductions, FEFOLot } from './fefo-logic';

test('calculateFEFODeductions', async (t) => {
  await t.test('deducts from single lot with exact match', () => {
    const lots: FEFOLot[] = [{ id: 1, quantity: 10 }];
    const deductions = calculateFEFODeductions(lots, 10);
    assert.deepStrictEqual(deductions, [{ lotId: 1, deductedAmount: 10 }]);
  });

  await t.test('deducts from multiple lots (partial deduction across lots)', () => {
    const lots: FEFOLot[] = [
      { id: 1, quantity: 5 },
      { id: 2, quantity: 10 },
      { id: 3, quantity: 5 }
    ];
    const deductions = calculateFEFODeductions(lots, 12);
    assert.deepStrictEqual(deductions, [
      { lotId: 1, deductedAmount: 5 },
      { lotId: 2, deductedAmount: 7 }
    ]);
  });

  await t.test('deducts exactly up to the last lot', () => {
    const lots: FEFOLot[] = [
      { id: 1, quantity: 5 },
      { id: 2, quantity: 5 }
    ];
    const deductions = calculateFEFODeductions(lots, 10);
    assert.deepStrictEqual(deductions, [
      { lotId: 1, deductedAmount: 5 },
      { lotId: 2, deductedAmount: 5 }
    ]);
  });

  await t.test('skips empty or negative lots', () => {
    const lots: FEFOLot[] = [
      { id: 1, quantity: 0 },
      { id: 2, quantity: -2 },
      { id: 3, quantity: 5 }
    ];
    const deductions = calculateFEFODeductions(lots, 4);
    assert.deepStrictEqual(deductions, [
      { lotId: 3, deductedAmount: 4 }
    ]);
  });

  await t.test('throws on insufficient stock', () => {
    const lots: FEFOLot[] = [{ id: 1, quantity: 5 }];
    assert.throws(
      () => calculateFEFODeductions(lots, 10),
      /Insufficient stock/
    );
  });

  await t.test('returns empty array when requiredQuantity is 0', () => {
    const lots: FEFOLot[] = [{ id: 1, quantity: 5 }];
    const deductions = calculateFEFODeductions(lots, 0);
    assert.deepStrictEqual(deductions, []);
  });

  await t.test('accurately handles fractional portions without floating point underflow', () => {
    // 3 portions of 0.333 kg from a 1.000 kg lot leaves 0.001
    const lots: FEFOLot[] = [{ id: 1, quantity: "1.000" }];
    const deductions = calculateFEFODeductions(lots, "0.999");
    assert.deepStrictEqual(deductions, [{ lotId: 1, deductedAmount: 0.999 }]);
  });

  await t.test('accepts exact match with decimal string without false insufficient stock', () => {
    const lots: FEFOLot[] = [
      { id: 1, quantity: "0.1" },
      { id: 2, quantity: "0.2" }
    ];
    // In float math 0.1 + 0.2 === 0.30000000000000004
    const deductions = calculateFEFODeductions(lots, "0.3");
    assert.deepStrictEqual(deductions, [
      { lotId: 1, deductedAmount: 0.1 },
      { lotId: 2, deductedAmount: 0.2 }
    ]);
  });
});
