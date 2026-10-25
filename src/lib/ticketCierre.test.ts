import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirTicketCierre, formatearBs, type CierreCajaData } from './ticketCierre';

const base: CierreCajaData = {
  cajaId: 7,
  empleadoNombre: 'Ana',
  fechaApertura: '2026-10-24T12:00:00.000Z',
  fechaCierre: '2026-10-24T20:00:00.000Z',
  saldoInicial: 100,
  ventasPorMetodo: {
    ventas_efectivo: 250.5,
    ventas_tarjeta: 80,
    ventas_qr: 30.25,
    ventas_transfer: 0,
    ventas_giftcard: 10,
    ventas_otros: 5,
  },
  totalVentas: 375.75,
  efectivoEsperado: 350.5,
  totalContado: 350.5,
  diferenciaEfectivo: 0,
};

describe('formatearBs', () => {
  it('formats with "Bs" prefix and 2 decimals', () => {
    assert.equal(formatearBs(0), 'Bs 0.00');
    assert.equal(formatearBs(12.5), 'Bs 12.50');
    assert.equal(formatearBs(1.005 * 100), 'Bs 100.50');
  });
});

describe('construirTicketCierre', () => {
  it('orders payment-method lines with Spanish labels', () => {
    const t = construirTicketCierre(base);
    assert.deepEqual(
      t.lineasMetodo.map((l) => l.etiqueta),
      ['Efectivo', 'Tarjeta', 'QR', 'Transferencia', 'Gift Card', 'Otros']
    );
    assert.deepEqual(
      t.lineasMetodo.map((l) => l.monto),
      ['Bs 250.50', 'Bs 80.00', 'Bs 30.25', 'Bs 0.00', 'Bs 10.00', 'Bs 5.00']
    );
  });

  it('formats totals and cash figures', () => {
    const t = construirTicketCierre(base);
    assert.equal(t.totalVentas, 'Bs 375.75');
    assert.equal(t.saldoInicial, 'Bs 100.00');
    assert.equal(t.efectivoEsperado, 'Bs 350.50');
    assert.equal(t.totalContado, 'Bs 350.50');
    assert.equal(t.cajaId, '7');
    assert.equal(t.empleadoNombre, 'Ana');
  });

  it('positive difference is Sobrante', () => {
    const t = construirTicketCierre({ ...base, diferenciaEfectivo: 12.5 });
    assert.equal(t.diferencia.etiqueta, 'Sobrante');
    assert.equal(t.diferencia.monto, 'Bs 12.50');
  });

  it('negative difference is Faltante with absolute amount', () => {
    const t = construirTicketCierre({ ...base, diferenciaEfectivo: -3 });
    assert.equal(t.diferencia.etiqueta, 'Faltante');
    assert.equal(t.diferencia.monto, 'Bs 3.00');
  });

  it('|diff| < 0.01 is Exacta', () => {
    for (const d of [0, 0.004, -0.004]) {
      const t = construirTicketCierre({ ...base, diferenciaEfectivo: d });
      assert.equal(t.diferencia.etiqueta, 'Exacta');
      assert.equal(t.diferencia.monto, 'Bs 0.00');
    }
  });

  it('does not include observaciones in the ticket', () => {
    const t = construirTicketCierre(base);
    assert.equal('observaciones' in t, false);
  });
});
