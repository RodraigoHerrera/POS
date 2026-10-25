import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePeriodo, rangoPeriodo } from './periodo';

describe('parsePeriodo', () => {
  it('devuelve "mes" por defecto (null/undefined/vacío)', () => {
    assert.equal(parsePeriodo(null), 'mes');
    assert.equal(parsePeriodo(undefined), 'mes');
    assert.equal(parsePeriodo(''), 'mes');
  });

  it('acepta "mes" y "semana"', () => {
    assert.equal(parsePeriodo('mes'), 'mes');
    assert.equal(parsePeriodo('semana'), 'semana');
  });

  it('valores inválidos caen a "mes"', () => {
    assert.equal(parsePeriodo('dia'), 'mes');
    assert.equal(parsePeriodo('SEMANA'), 'mes');
  });
});

describe('rangoPeriodo - mes', () => {
  it('mes a mitad de año', () => {
    const r = rangoPeriodo('mes', new Date(2026, 4, 15, 10, 30));
    assert.deepEqual(r.inicio, new Date(2026, 4, 1, 0, 0, 0, 0));
    assert.deepEqual(r.fin, new Date(2026, 4, 31, 23, 59, 59, 999));
    assert.deepEqual(r.inicioAnterior, new Date(2026, 3, 1, 0, 0, 0, 0));
    assert.deepEqual(r.finAnterior, new Date(2026, 3, 30, 23, 59, 59, 999));
  });

  it('enero: el mes anterior es diciembre del año previo', () => {
    const r = rangoPeriodo('mes', new Date(2026, 0, 10));
    assert.deepEqual(r.inicio, new Date(2026, 0, 1));
    assert.deepEqual(r.fin, new Date(2026, 0, 31, 23, 59, 59, 999));
    assert.deepEqual(r.inicioAnterior, new Date(2025, 11, 1));
    assert.deepEqual(r.finAnterior, new Date(2025, 11, 31, 23, 59, 59, 999));
  });
});

describe('rangoPeriodo - semana (lunes a domingo)', () => {
  it('mitad de semana (miércoles 2026-10-21)', () => {
    const r = rangoPeriodo('semana', new Date(2026, 9, 21, 15, 0));
    assert.deepEqual(r.inicio, new Date(2026, 9, 19, 0, 0, 0, 0));
    assert.deepEqual(r.fin, new Date(2026, 9, 25, 23, 59, 59, 999));
    assert.deepEqual(r.inicioAnterior, new Date(2026, 9, 12, 0, 0, 0, 0));
    assert.deepEqual(r.finAnterior, new Date(2026, 9, 18, 23, 59, 59, 999));
  });

  it('lunes es el inicio de la semana', () => {
    const r = rangoPeriodo('semana', new Date(2026, 9, 19, 0, 0, 0, 0));
    assert.deepEqual(r.inicio, new Date(2026, 9, 19));
    assert.deepEqual(r.fin, new Date(2026, 9, 25, 23, 59, 59, 999));
  });

  it('domingo pertenece a la semana que empezó el lunes anterior', () => {
    const r = rangoPeriodo('semana', new Date(2026, 9, 25, 23, 0));
    assert.deepEqual(r.inicio, new Date(2026, 9, 19));
    assert.deepEqual(r.fin, new Date(2026, 9, 25, 23, 59, 59, 999));
  });

  it('cruza fin de mes/año hacia atrás', () => {
    // Jueves 2026-01-01 -> semana lun 2025-12-29 a dom 2026-01-04
    const r = rangoPeriodo('semana', new Date(2026, 0, 1));
    assert.deepEqual(r.inicio, new Date(2025, 11, 29));
    assert.deepEqual(r.fin, new Date(2026, 0, 4, 23, 59, 59, 999));
    assert.deepEqual(r.inicioAnterior, new Date(2025, 11, 22));
    assert.deepEqual(r.finAnterior, new Date(2025, 11, 28, 23, 59, 59, 999));
  });
});
