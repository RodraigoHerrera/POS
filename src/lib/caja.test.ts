import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './db';
import {
  calcularResumenCaja,
  calcularDiferenciaConciliacion,
  validateOrderForBilling,
  validateOrderEditState,
  validateSimulationResults,
} from './caja';
import { isDeadlockError } from './transactionRetry';

describe('SEC-04 Invariants: Race Condition Edition & Cobro', () => {

  describe('INV-SEC04-1: State Immutability (validateOrderEditState)', () => {
    it('rejects editing an order that is PAGADO with PEDIDO_ALREADY_CLOSED', () => {
      assert.throws(
        () => validateOrderEditState({ id: BigInt(101), sucursal_id: BigInt(1), estado: 'PAGADO' }),
        { message: 'PEDIDO_ALREADY_CLOSED' }
      );
    });

    it('rejects editing an order that is ANULADO with PEDIDO_ALREADY_CLOSED', () => {
      assert.throws(
        () => validateOrderEditState({ id: BigInt(101), sucursal_id: BigInt(1), estado: 'ANULADO' }),
        { message: 'PEDIDO_ALREADY_CLOSED' }
      );
    });

    it('rejects editing when lockedOrder is null or undefined with PEDIDO_NOT_FOUND', () => {
      assert.throws(
        () => validateOrderEditState(null),
        { message: 'PEDIDO_NOT_FOUND' }
      );
      assert.throws(
        () => validateOrderEditState(undefined),
        { message: 'PEDIDO_NOT_FOUND' }
      );
    });

    it('allows editing an order that is PENDIENTE or COMANDADO', () => {
      assert.doesNotThrow(() =>
        validateOrderEditState({ id: BigInt(101), sucursal_id: BigInt(1), estado: 'PENDIENTE' })
      );
      assert.doesNotThrow(() =>
        validateOrderEditState({ id: BigInt(101), sucursal_id: BigInt(1), estado: 'COMANDADO' })
      );
    });
  });

  describe('INV-SEC04-2: Invoice Non-Emptiness & Validation (validateOrderForBilling)', () => {
    const baseLocked = {
      id: BigInt(101),
      sucursal_id: BigInt(1),
      estado: 'COMANDADO',
      total: 50.0,
    };

    it('rejects missing order with "Pedido no encontrado"', () => {
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: null,
            sucursalId: '1',
            items: [{ id: 1, cantidad: 1, subtotal: 50 }],
            total: 50,
          }),
        { message: 'Pedido no encontrado' }
      );
    });

    it('rejects sucursal mismatch with "Pedido no encontrado"', () => {
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: { ...baseLocked, sucursal_id: BigInt(2) },
            sucursalId: '1',
            items: [{ id: 1, cantidad: 1, subtotal: 50 }],
            total: 50,
          }),
        { message: 'Pedido no encontrado' }
      );
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: { ...baseLocked, sucursal_id: BigInt(1) },
            sucursalId: '2',
            items: [{ id: 1, cantidad: 1, subtotal: 50 }],
            total: 50,
          }),
        { message: 'Pedido no encontrado' }
      );
    });

    it('rejects billing an order that is already PAGADO with "El pedido ya fue pagado"', () => {
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: { ...baseLocked, estado: 'PAGADO' },
            sucursalId: '1',
            items: [{ id: 1, cantidad: 1, subtotal: 50 }],
            total: 50,
          }),
        { message: 'El pedido ya fue pagado' }
      );
    });

    it('rejects billing an order that is ANULADO with "El pedido está anulado"', () => {
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: { ...baseLocked, estado: 'ANULADO' },
            sucursalId: '1',
            items: [{ id: 1, cantidad: 1, subtotal: 50 }],
            total: 50,
          }),
        { message: 'El pedido está anulado' }
      );
    });

    it('rejects billing an order with empty items array ([]) with "El pedido no contiene items para facturar."', () => {
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: baseLocked,
            sucursalId: '1',
            items: [],
            total: 50.0,
          }),
        { message: 'El pedido no contiene items para facturar.' }
      );
      // Also test via pedidoDetail
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: baseLocked,
            sucursalId: '1',
            pedidoDetail: { items: [], total: 50.0 },
          }),
        { message: 'El pedido no contiene items para facturar.' }
      );
    });

    it('rejects billing an order with undefined items with "El pedido no contiene items para facturar."', () => {
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: baseLocked,
            sucursalId: '1',
            items: undefined,
            total: 50.0,
          }),
        { message: 'El pedido no contiene items para facturar.' }
      );
    });

    it('rejects billing an order with total <= 0 with "El total del pedido debe ser mayor a 0"', () => {
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: { ...baseLocked, total: 0 },
            sucursalId: '1',
            items: [{ id: 1, cantidad: 1, subtotal: 0 }],
            total: 0,
          }),
        { message: 'El total del pedido debe ser mayor a 0' }
      );
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: { ...baseLocked, total: -10 },
            sucursalId: '1',
            items: [{ id: 1, cantidad: 1, subtotal: -10 }],
            total: -10,
          }),
        { message: 'El total del pedido debe ser mayor a 0' }
      );
    });

    it('rejects billing when cash payment is insufficient with "Monto pagado insuficiente"', () => {
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: baseLocked,
            sucursalId: '1',
            items: [{ id: 1, cantidad: 1, subtotal: 50 }],
            total: 50.0,
            metodoPago: 'cash',
            recibido: 40.0,
          }),
        { message: 'Monto pagado insuficiente' }
      );
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: baseLocked,
            sucursalId: '1',
            pedidoDetail: { items: [{ id: 1, cantidad: 1, subtotal: 50 }], total: 50.0 },
            metodoPago: 'efectivo',
            montoPagado: 49.99,
          }),
        { message: 'Monto pagado insuficiente' }
      );
      assert.throws(
        () =>
          validateOrderForBilling({
            lockedOrder: baseLocked,
            sucursalId: '1',
            items: [{ id: 1, cantidad: 1, subtotal: 50 }],
            total: 50.0,
            metodoPago: 'cash',
            recibido: undefined,
          }),
        { message: 'Monto pagado insuficiente' }
      );
    });

    it('passes when order is valid and non-empty (cash payment)', () => {
      assert.doesNotThrow(() =>
        validateOrderForBilling({
          lockedOrder: baseLocked,
          sucursalId: '1',
          items: [{ id: 1, cantidad: 1, subtotal: 50 }],
          total: 50.0,
          metodoPago: 'cash',
          recibido: 50.0,
        })
      );
      assert.doesNotThrow(() =>
        validateOrderForBilling({
          lockedOrder: baseLocked,
          sucursalId: '1',
          pedidoDetail: { items: [{ id: 1, cantidad: 1, subtotal: 50 }], total: 50.0 },
          metodoPago: 'cash',
          montoPagado: 100.0,
        })
      );
    });

    it('passes when order is valid and non-empty (electronic payment)', () => {
      assert.doesNotThrow(() =>
        validateOrderForBilling({
          lockedOrder: baseLocked,
          sucursalId: '1',
          items: [{ id: 1, cantidad: 1, subtotal: 50 }],
          total: 50.0,
          metodoPago: 'card',
        })
      );
      assert.doesNotThrow(() =>
        validateOrderForBilling({
          lockedOrder: baseLocked,
          sucursalId: BigInt(1),
          items: [{ id: 1, cantidad: 1, subtotal: 50 }],
          total: 50.0,
          metodoPago: 'qr',
        })
      );
    });
  });

  describe('INV-SEC04-4: Non-Destructive FEFO Abort (validateSimulationResults)', () => {
    it('throws error when zero items are fulfilled', () => {
      assert.throws(
        () => validateSimulationResults(0),
        { message: 'No hay suficiente stock para preparar ningún item de esta actualización.' }
      );
    });

    it('passes when at least 1 item is fulfilled', () => {
      assert.doesNotThrow(() => validateSimulationResults(1));
      assert.doesNotThrow(() => validateSimulationResults(5));
    });

    it('confirms isDeadlockError evaluates to false on zero stock error (fail-fast guarantee)', () => {
      let thrownError: unknown;
      try {
        validateSimulationResults(0);
      } catch (err) {
        thrownError = err;
      }

      assert.ok(thrownError instanceof Error);
      assert.equal(
        thrownError.message,
        'No hay suficiente stock para preparar ningún item de esta actualización.'
      );
      // Crucial: Must NOT be treated as InnoDB deadlock/timeout so retry loop fails fast
      assert.equal(
        isDeadlockError(thrownError),
        false,
        'Simulation stock failure must fail fast and never trigger retry backoff'
      );
    });
  });

});

describe('Caja Domain Utilities (calcularResumenCaja)', () => {
  it('accurately sums decimal sales without floating-point precision leakage (0.10 + 0.20 = 0.30)', async () => {
    const originalFindMany = prisma.factura.findMany;
    prisma.factura.findMany = (async () => [
      { importe_total: '0.10', metodo_pago: 'cash' },
      { importe_total: '0.20', metodo_pago: 'cash' },
      { importe_total: '19.99', metodo_pago: 'card' },
      { importe_total: '0.01', metodo_pago: 'card' },
    ]) as any;

    try {
      const caja = {
        id: BigInt(100),
        saldo_inicial: '10.00',
        fecha_apertura: new Date(),
      };

      const resumen = await calcularResumenCaja(caja);

      // In IEEE-754 binary float, 0.10 + 0.20 === 0.30000000000000004
      // With Decimal-backed aggregation, it is strictly 0.3
      assert.equal(resumen.ventasPorMetodo.ventas_efectivo, 0.3);
      assert.equal(resumen.ventasPorMetodo.ventas_tarjeta, 20);
      assert.equal(resumen.totalVentas, 20.3);
      assert.equal(resumen.efectivoEsperado, 10.3);
    } finally {
      prisma.factura.findMany = originalFindMany;
    }
  });
});

describe('calcularDiferenciaConciliacion (pure helper)', () => {
  it('returns 0 when declared equals expected', () => {
    assert.equal(calcularDiferenciaConciliacion(120.5, 120.5), 0);
  });

  it('returns positive difference (sobrante) rounded to 2 decimals', () => {
    assert.equal(calcularDiferenciaConciliacion(130.75, 120.5), 10.25);
  });

  it('returns negative difference (faltante)', () => {
    assert.equal(calcularDiferenciaConciliacion(100, 120.5), -20.5);
  });

  it('discards floating point residue (0.1 + 0.2 vs 0.3)', () => {
    assert.equal(calcularDiferenciaConciliacion(0.1 + 0.2, 0.3), 0);
  });

  it('treats a residue below half a cent as 0, both signs', () => {
    assert.equal(calcularDiferenciaConciliacion(10.004, 10), 0);
    assert.equal(calcularDiferenciaConciliacion(10, 10.004), 0);
  });

  it('handles zero expected', () => {
    assert.equal(calcularDiferenciaConciliacion(15.5, 0), 15.5);
    assert.equal(calcularDiferenciaConciliacion(0, 0), 0);
  });
});
