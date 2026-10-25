import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCostoUnitario } from './costo';

describe('formatCostoUnitario', () => {
  it('shows sub-cent costs without truncating to 2 decimals', () => {
    assert.equal(formatCostoUnitario(0.00347), '0.00347');
    assert.equal(formatCostoUnitario(17.333333), '17.333333');
  });

  it('keeps a 2-decimal minimum for regular costs', () => {
    assert.equal(formatCostoUnitario(15), '15.00');
    assert.equal(formatCostoUnitario(12.5), '12.50');
    assert.equal(formatCostoUnitario(0), '0.00');
  });

  it('does not group thousands', () => {
    assert.equal(formatCostoUnitario(1234.5), '1234.50');
  });

  it('falls back to 0.00 for non-finite values', () => {
    assert.equal(formatCostoUnitario(NaN), '0.00');
    assert.equal(formatCostoUnitario(Infinity), '0.00');
  });
});
