import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  labelUnidad,
  hintUnidad,
  UNIDADES_OPTIONS,
  opcionesUnidad,
} from './unidad';

describe('UNIDADES_OPTIONS', () => {
  it('lists the 7 units in order with their labels', () => {
    assert.deepEqual(
      UNIDADES_OPTIONS.map((o) => o.value),
      ['unidad', 'caja', 'paquete', 'litro', 'kilogramo', 'gramo', 'mililitro']
    );
    assert.deepEqual(UNIDADES_OPTIONS.slice(0, 5), [
      { value: 'unidad', label: 'Unidad' },
      { value: 'caja', label: 'Caja' },
      { value: 'paquete', label: 'Paquete' },
      { value: 'litro', label: 'Litro' },
      { value: 'kilogramo', label: 'Kilogramo' },
    ]);
    assert.deepEqual(UNIDADES_OPTIONS[5], { value: 'gramo', label: 'Gramo' });
    assert.deepEqual(UNIDADES_OPTIONS[6], { value: 'mililitro', label: 'Mililitro' });
  });

  it('has unique values', () => {
    const values = UNIDADES_OPTIONS.map((o) => o.value);
    assert.equal(new Set(values).size, values.length);
  });

  it('resolves gramo and mililitro through labelUnidad without the fallback', () => {
    assert.equal(labelUnidad('gramo'), 'gramo');
    assert.equal(labelUnidad('mililitro'), 'mililitro');
  });
});

describe('opcionesUnidad', () => {
  it('returns the catalog when no current unit is given', () => {
    assert.deepEqual(opcionesUnidad(), [...UNIDADES_OPTIONS]);
  });

  it('returns a new array that does not mutate the catalog', () => {
    const before = UNIDADES_OPTIONS.length;
    const result = opcionesUnidad();
    result.push({ value: 'x', label: 'X' });
    assert.equal(UNIDADES_OPTIONS.length, before);
  });

  it('adds no extra option for a catalog unit', () => {
    assert.deepEqual(opcionesUnidad('gramo'), [...UNIDADES_OPTIONS]);
  });

  it('appends a legacy unit as the last option', () => {
    const result = opcionesUnidad('kg');
    assert.equal(result.length, UNIDADES_OPTIONS.length + 1);
    assert.deepEqual(result[result.length - 1], { value: 'kg', label: 'kg (actual)' });
  });

  it('adds no extra option for null, undefined, empty or whitespace', () => {
    for (const v of [null, undefined, '', '  ']) {
      assert.equal(opcionesUnidad(v).length, UNIDADES_OPTIONS.length);
    }
  });
});

describe('labelUnidad', () => {
  it('returns the code as-is when already clean', () => {
    assert.equal(labelUnidad('kg'), 'kg');
  });

  it('trims padded codes', () => {
    assert.equal(labelUnidad(' kg '), 'kg');
    assert.equal(labelUnidad(' l '), 'l');
  });

  it('falls back to "u" for empty, whitespace, null and undefined', () => {
    assert.equal(labelUnidad(''), 'u');
    assert.equal(labelUnidad('   '), 'u');
    assert.equal(labelUnidad(null), 'u');
    assert.equal(labelUnidad(undefined), 'u');
  });
});

describe('hintUnidad', () => {
  const unidades = { '1': 'kg', '2': '', '3': '   ', '4': ' l ' };

  it('returns undefined when nothing is selected', () => {
    assert.equal(hintUnidad('', unidades), undefined);
  });

  it('returns undefined for ids absent from the lookup', () => {
    assert.equal(hintUnidad('99', unidades), undefined);
    assert.equal(hintUnidad('1', {}), undefined);
  });

  it('ignores prototype keys', () => {
    assert.equal(hintUnidad('toString', unidades), undefined);
    assert.equal(hintUnidad('constructor', unidades), undefined);
  });

  it('shows the unit of a known item', () => {
    assert.equal(hintUnidad('1', unidades), 'Unidad: kg');
  });

  it('falls back to "u" for known items with empty or whitespace unit', () => {
    assert.equal(hintUnidad('2', unidades), 'Unidad: u');
    assert.equal(hintUnidad('3', unidades), 'Unidad: u');
  });

  it('trims padded codes', () => {
    assert.equal(hintUnidad('4', unidades), 'Unidad: l');
  });

  it('follows selection changes', () => {
    assert.equal(hintUnidad('1', unidades), 'Unidad: kg');
    assert.equal(hintUnidad('4', unidades), 'Unidad: l');
  });
});
