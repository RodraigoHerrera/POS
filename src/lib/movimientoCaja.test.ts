import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarMovimientoCaja,
  TIPO_MOVIMIENTO_DB,
  puedeRetirar,
} from './movimientoCaja';
import { ValidationError } from './validation';

const ok = { tipo: 'ENTRADA', monto: 20, razon: 'Cambio adicional' };

describe('validarMovimientoCaja', () => {
  it('accepts a valid ENTRADA and returns normalized data', () => {
    assert.deepEqual(validarMovimientoCaja(ok), { tipo: 'ENTRADA', monto: 20, razon: 'Cambio adicional' });
  });

  it('accepts a numeric string amount and trims the reason', () => {
    const r = validarMovimientoCaja({ tipo: 'SALIDA', monto: ' 5.50 ', razon: '  Pago hielo  ' });
    assert.deepEqual(r, { tipo: 'SALIDA', monto: 5.5, razon: 'Pago hielo' });
  });

  it('rejects non-object input', () => {
    assert.throws(() => validarMovimientoCaja(null), ValidationError);
    assert.throws(() => validarMovimientoCaja('x'), ValidationError);
  });

  it('rejects unknown tipo (case-sensitive)', () => {
    assert.throws(() => validarMovimientoCaja({ ...ok, tipo: 'entrada' }), ValidationError);
    assert.throws(() => validarMovimientoCaja({ ...ok, tipo: 'INGRESO' }), ValidationError);
    assert.throws(() => validarMovimientoCaja({ ...ok, tipo: undefined }), ValidationError);
  });

  it('rejects zero, negative, NaN, boolean, empty and non-numeric amounts', () => {
    for (const monto of [0, -1, NaN, Infinity, true, '', 'abc', null, undefined, {}]) {
      assert.throws(() => validarMovimientoCaja({ ...ok, monto }), ValidationError, String(monto));
    }
  });

  it('rejects more than 2 decimals', () => {
    assert.throws(() => validarMovimientoCaja({ ...ok, monto: 1.234 }), ValidationError);
    assert.throws(() => validarMovimientoCaja({ ...ok, monto: '1.005' }), ValidationError);
    assert.equal(validarMovimientoCaja({ ...ok, monto: 0.3 }).monto, 0.3);
  });

  it('rejects amounts above the upper bound', () => {
    assert.throws(() => validarMovimientoCaja({ ...ok, monto: 1_000_000.01 }), ValidationError);
    assert.equal(validarMovimientoCaja({ ...ok, monto: 1_000_000 }).monto, 1_000_000);
  });

  it('rejects reasons shorter than 3 or longer than 200 chars after trim, or non-string', () => {
    assert.throws(() => validarMovimientoCaja({ ...ok, razon: '  ab  ' }), ValidationError);
    assert.throws(() => validarMovimientoCaja({ ...ok, razon: '' }), ValidationError);
    assert.throws(() => validarMovimientoCaja({ ...ok, razon: 'x'.repeat(201) }), ValidationError);
    assert.throws(() => validarMovimientoCaja({ ...ok, razon: 123 }), ValidationError);
    assert.equal(validarMovimientoCaja({ ...ok, razon: 'x'.repeat(200) }).razon.length, 200);
    assert.equal(validarMovimientoCaja({ ...ok, razon: 'abc' }).razon, 'abc');
  });

  it('error carries the field name', () => {
    try {
      validarMovimientoCaja({ ...ok, razon: 'a' });
      assert.fail('should throw');
    } catch (e) {
      assert.ok(e instanceof ValidationError);
      assert.equal(e.field, 'razon');
    }
  });
});

describe('TIPO_MOVIMIENTO_DB', () => {
  it('maps ENTRADA to INGRESO and SALIDA to EGRESO', () => {
    assert.equal(TIPO_MOVIMIENTO_DB.ENTRADA, 'INGRESO');
    assert.equal(TIPO_MOVIMIENTO_DB.SALIDA, 'EGRESO');
  });
});

describe('puedeRetirar', () => {
  it('allows withdrawing up to the available cash, with cents precision', () => {
    assert.equal(puedeRetirar(5, 10), true);
    assert.equal(puedeRetirar(10, 10), true);
    assert.equal(puedeRetirar(0.3, 0.1 + 0.2), true);
  });
  it('rejects withdrawing more than available', () => {
    assert.equal(puedeRetirar(10.01, 10), false);
    assert.equal(puedeRetirar(1, 0), false);
    assert.equal(puedeRetirar(1, -5), false);
  });
});
