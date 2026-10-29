import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatearDiaLocal, rangoDesdeSeleccion } from './rangoFechas';

describe('formatearDiaLocal', () => {
  it('formats the local calendar day as YYYY-MM-DD with padding', () => {
    assert.equal(formatearDiaLocal(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  });
});

describe('rangoDesdeSeleccion', () => {
  it('returns null while the range is incomplete', () => {
    assert.equal(rangoDesdeSeleccion([new Date(2026, 9, 1)]), null);
  });

  it('returns an empty range when the selection is cleared', () => {
    assert.deepEqual(rangoDesdeSeleccion([]), { desde: '', hasta: '' });
  });

  it('returns desde/hasta for a complete range', () => {
    assert.deepEqual(rangoDesdeSeleccion([new Date(2026, 9, 1), new Date(2026, 9, 29)]), {
      desde: '2026-10-01',
      hasta: '2026-10-29',
    });
  });

  it('orders the days even if they arrive reversed', () => {
    assert.deepEqual(rangoDesdeSeleccion([new Date(2026, 9, 29), new Date(2026, 9, 1)]), {
      desde: '2026-10-01',
      hasta: '2026-10-29',
    });
  });
});
