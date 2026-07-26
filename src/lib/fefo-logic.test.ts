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
});
