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
  entradasEfectivo: 0,
  salidasEfectivo: 0,
  efectivoEsperado: 350.5,
  totalContado: 350.5,
  diferenciaEfectivo: 0,
  tarjetaEsperado: 80,
  totalTarjeta: 80,
  diferenciaTarjeta: 0,
  qrEsperado: 30.25,
  totalQr: 30.25,
  diferenciaQr: 0,
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

  it('formats manual cash entries and withdrawals', () => {
    const t = construirTicketCierre({ ...base, entradasEfectivo: 20, salidasEfectivo: 5.5 });
    assert.equal(t.entradasEfectivo, 'Bs 20.00');
    assert.equal(t.salidasEfectivo, 'Bs 5.50');
  });

  it('formats zero entradas/salidas as Bs 0.00', () => {
    const t = construirTicketCierre(base);
    assert.equal(t.entradasEfectivo, 'Bs 0.00');
    assert.equal(t.salidasEfectivo, 'Bs 0.00');
  });

  it('formats totals and opening cash', () => {
    const t = construirTicketCierre(base);
    assert.equal(t.totalVentas, 'Bs 375.75');
    assert.equal(t.saldoInicial, 'Bs 100.00');
    assert.equal(t.cajaId, '7');
    assert.equal(t.empleadoNombre, 'Ana');
  });

  it('does not duplicate cash figures outside conciliacion', () => {
    const t = construirTicketCierre(base);
    for (const clave of ['efectivoEsperado', 'totalContado', 'diferencia']) {
      assert.equal(clave in t, false, clave);
    }
  });

  it('positive cash difference is Sobrante', () => {
    const t = construirTicketCierre({ ...base, diferenciaEfectivo: 12.5 });
    assert.deepEqual(t.conciliacion[0].diferencia, { etiqueta: 'Sobrante', monto: 'Bs 12.50' });
  });

  it('negative cash difference is Faltante with absolute amount', () => {
    const t = construirTicketCierre({ ...base, diferenciaEfectivo: -3 });
    assert.deepEqual(t.conciliacion[0].diferencia, { etiqueta: 'Faltante', monto: 'Bs 3.00' });
  });

  it('|diff| < 0.01 is Exacta', () => {
    for (const d of [0, 0.004, -0.004]) {
      const t = construirTicketCierre({ ...base, diferenciaEfectivo: d });
      assert.deepEqual(t.conciliacion[0].diferencia, { etiqueta: 'Exacta', monto: 'Bs 0.00' });
    }
  });

  it('builds conciliacion rows in fixed order Efectivo, Tarjeta, QR', () => {
    const t = construirTicketCierre(base);
    assert.deepEqual(
      t.conciliacion.map((c) => c.metodo),
      ['Efectivo', 'Tarjeta', 'QR']
    );
    assert.deepEqual(t.conciliacion[0], {
      metodo: 'Efectivo',
      esperado: 'Bs 350.50',
      declarado: 'Bs 350.50',
      diferencia: { etiqueta: 'Exacta', monto: 'Bs 0.00' },
    });
    assert.deepEqual(t.conciliacion[1], {
      metodo: 'Tarjeta',
      esperado: 'Bs 80.00',
      declarado: 'Bs 80.00',
      diferencia: { etiqueta: 'Exacta', monto: 'Bs 0.00' },
    });
    assert.equal(t.conciliacion[2].esperado, 'Bs 30.25');
    assert.equal(t.conciliacion[2].declarado, 'Bs 30.25');
  });

  it('classifies tarjeta and QR differences independently', () => {
    const t = construirTicketCierre({
      ...base,
      totalTarjeta: 75,
      diferenciaTarjeta: -5,
      totalQr: 32.25,
      diferenciaQr: 2,
    });
    assert.deepEqual(t.conciliacion[1].diferencia, { etiqueta: 'Faltante', monto: 'Bs 5.00' });
    assert.equal(t.conciliacion[1].declarado, 'Bs 75.00');
    assert.deepEqual(t.conciliacion[2].diferencia, { etiqueta: 'Sobrante', monto: 'Bs 2.00' });
    assert.equal(t.conciliacion[2].declarado, 'Bs 32.25');
    assert.equal(t.conciliacion[0].diferencia.etiqueta, 'Exacta');
  });

  it('does not include observaciones in the ticket', () => {
    const t = construirTicketCierre(base);
    assert.equal('observaciones' in t, false);
  });
});
