import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRangoFechas,
  ReporteVentasError,
  generarCSV,
  formatearFechaLocal,
  parseTipoReporte,
  filasPorUsuario,
  filasProductoResumen,
  filasProductoDetalle,
  filasPorCaja,
  filasAnuladas,
  CABECERAS_USUARIO,
  CABECERAS_PRODUCTO_RESUMEN,
  CABECERAS_PRODUCTO_DETALLE,
  CABECERAS_CAJA,
  CABECERAS_ANULADAS,
} from './reporteVentas';

const TZ = 'America/La_Paz'; // UTC-4 sin DST

describe('parseTipoReporte', () => {
  it('acepta los 5 tipos y rechaza el resto', () => {
    for (const t of ['usuario', 'caja', 'producto-resumen', 'producto-detalle', 'anuladas']) {
      assert.equal(parseTipoReporte(t), t);
    }
    assert.equal(parseTipoReporte('otro'), null);
    assert.equal(parseTipoReporte(null), null);
    assert.equal(parseTipoReporte(''), null);
  });
});

describe('parseRangoFechas', () => {
  it('rango válido usa días locales y fin exclusivo', () => {
    const r = parseRangoFechas('2026-05-01', '2026-05-03', TZ);
    assert.equal(r.inicio.toISOString(), '2026-05-01T04:00:00.000Z');
    assert.equal(r.fin.toISOString(), '2026-05-04T04:00:00.000Z');
  });

  it('un solo día (desde == hasta)', () => {
    const r = parseRangoFechas('2026-05-01', '2026-05-01', TZ);
    assert.equal(r.fin.getTime() - r.inicio.getTime(), 24 * 3600 * 1000);
  });

  it('borde de zona: 23:30 local del último día cae dentro, 00:00 local siguiente fuera', () => {
    const r = parseRangoFechas('2026-05-01', '2026-05-01', TZ);
    const dentro = new Date('2026-05-02T03:30:00.000Z'); // 23:30 La Paz
    const fuera = new Date('2026-05-02T04:00:00.000Z'); // 00:00 La Paz del 2
    assert.ok(dentro >= r.inicio && dentro < r.fin);
    assert.ok(!(fuera < r.fin));
  });

  it('falta desde o hasta', () => {
    assert.throws(() => parseRangoFechas(null, '2026-05-01', TZ), ReporteVentasError);
    assert.throws(() => parseRangoFechas('2026-05-01', '', TZ), ReporteVentasError);
    assert.throws(() => parseRangoFechas(undefined, undefined, TZ), ReporteVentasError);
  });

  it('formato inválido o fecha inexistente', () => {
    assert.throws(() => parseRangoFechas('01/05/2026', '2026-05-02', TZ), ReporteVentasError);
    assert.throws(() => parseRangoFechas('2026-5-1', '2026-05-02', TZ), ReporteVentasError);
    assert.throws(() => parseRangoFechas('2026-02-30', '2026-03-02', TZ), ReporteVentasError);
  });

  it('desde > hasta', () => {
    assert.throws(() => parseRangoFechas('2026-05-03', '2026-05-01', TZ), /desde/i);
  });

  it('máximo 366 días inclusive', () => {
    assert.doesNotThrow(() => parseRangoFechas('2026-01-01', '2027-01-01', TZ)); // 366 días
    assert.throws(() => parseRangoFechas('2026-01-01', '2027-01-02', TZ), /366/);
  });
});

describe('formatearFechaLocal', () => {
  it('formatea en zona de negocio', () => {
    assert.equal(formatearFechaLocal(new Date('2026-05-02T03:30:00.000Z'), TZ), '2026-05-01 23:30');
  });
  it('null/undefined → vacío', () => {
    assert.equal(formatearFechaLocal(null, TZ), '');
    assert.equal(formatearFechaLocal(undefined, TZ), '');
  });
});

describe('generarCSV', () => {
  it('BOM + CRLF + separador coma', () => {
    const csv = generarCSV(['A', 'B'], [['x', 'y']]);
    assert.equal(csv, '﻿A,B\r\nx,y\r\n');
  });

  it('escapa comas, comillas y saltos de línea', () => {
    const csv = generarCSV(['H'], [['a,b'], ['di "hola"'], ['l1\nl2'], ['l1\r\nl2']]);
    const lineas = csv.slice(1);
    assert.equal(lineas, 'H\r\n"a,b"\r\n"di ""hola"""\r\n"l1\nl2"\r\n"l1\r\nl2"\r\n');
  });

  it('null/undefined vacío; números con 2 decimales', () => {
    const csv = generarCSV(['A', 'B', 'C', 'D'], [[null, undefined, 3, 2.5]]);
    assert.equal(csv, '﻿A,B,C,D\r\n,,3.00,2.50\r\n');
  });

  it('negativos numéricos no se tocan; no finitos quedan vacíos', () => {
    const csv = generarCSV(['A', 'B'], [[-1.256, Number.NaN]]);
    assert.equal(csv, '﻿A,B\r\n-1.26,\r\n');
  });

  it('guarda contra inyección de fórmulas en strings', () => {
    const csv = generarCSV(['H'], [['=SUM(A1)'], ['+1'], ['-1'], ['@cmd'], ['normal']]);
    assert.equal(csv, "﻿H\r\n'=SUM(A1)\r\n'+1\r\n'-1\r\n'@cmd\r\nnormal\r\n");
  });

  it('el prefijo de guarda convive con el quoting', () => {
    const csv = generarCSV(['H'], [['=a,b']]);
    assert.equal(csv, "﻿H\r\n\"'=a,b\"\r\n");
  });

  it('sin filas: solo cabeceras', () => {
    assert.equal(generarCSV(['A'], []), '﻿A\r\n');
  });
});

describe('filasPorUsuario', () => {
  const empleados = new Map([
    ['1', { nombre: 'Ana', usuario: 'ana', rol: 'Cajero' }],
    ['2', { nombre: 'Beto', usuario: 'beto', rol: 'Mesero' }],
  ]);
  const ventas = [
    { empleado_id: BigInt(1), pedido_id: BigInt(10), cantidad: 2, venta_total: '100.00', costo_total: '40.0000' },
    { empleado_id: BigInt(1), pedido_id: BigInt(10), cantidad: 1, venta_total: '50.00', costo_total: '20.0000' },
    { empleado_id: BigInt(1), pedido_id: BigInt(11), cantidad: 1, venta_total: '50.00', costo_total: '30.0000' },
    { empleado_id: BigInt(2), pedido_id: BigInt(12), cantidad: 3, venta_total: '300.00', costo_total: '90.0000' },
    { empleado_id: BigInt(9), pedido_id: BigInt(13), cantidad: 1, venta_total: '10.00', costo_total: '10.0000' },
  ];

  it('agrupa por empleado, pedidos distintos, ticket promedio y margen %', () => {
    const filas = filasPorUsuario(ventas, empleados);
    assert.equal(filas.length, 3);
    // ordenado por venta total desc: Beto (300), Ana (200), 9 (10)
    assert.deepEqual(filas[0], ['2', 'Beto', 'beto', 'Mesero', '1', '3', 300, 90, 210, 70, 300]);
    assert.deepEqual(filas[1], ['1', 'Ana', 'ana', 'Cajero', '2', '4', 200, 90, 110, 55, 100]);
  });

  it('empleado desconocido → campos vacíos y margen % 0 con costo=venta', () => {
    const filas = filasPorUsuario(ventas, empleados);
    assert.deepEqual(filas[2], ['9', '', '', '', '1', '1', 10, 10, 0, 0, 10]);
  });

  it('cabeceras acordes a la cantidad de columnas', () => {
    assert.equal(CABECERAS_USUARIO.length, 11);
  });

  it('sin ventas → sin filas; venta 0 no divide por cero', () => {
    assert.deepEqual(filasPorUsuario([], empleados), []);
    const f = filasPorUsuario(
      [{ empleado_id: BigInt(1), pedido_id: BigInt(1), cantidad: 1, venta_total: 0, costo_total: 0 }],
      empleados,
    );
    assert.equal(f[0][9], 0);
    assert.equal(f[0][10], 0);
  });
});

describe('filasProductoResumen', () => {
  const ventas = [
    { producto_id: BigInt(1), producto_nombre: 'Burger', sku_producto: 'B1', categoria: 'Comida', cantidad: 2, venta_total: '60.00', costo_total: '30.0000', costo_teorico_total: '24.0000' },
    { producto_id: BigInt(1), producto_nombre: 'Burger', sku_producto: 'B1', categoria: 'Comida', cantidad: 2, venta_total: '60.00', costo_total: '30.0000', costo_teorico_total: '24.0000' },
    { producto_id: BigInt(2), producto_nombre: 'Soda', sku_producto: null, categoria: null, cantidad: 4, venta_total: '80.00', costo_total: '20.0000', costo_teorico_total: '22.0000' },
  ];

  it('agrupa por producto con precio promedio, brecha, margen y % de la venta', () => {
    const filas = filasProductoResumen(ventas);
    assert.equal(filas.length, 2);
    // total = 200; Burger 120 (60%), Soda 80 (40%)
    assert.deepEqual(filas[0], ['1', 'Burger', 'B1', 'Comida', '4', 30, 120, 60, 48, 12, 60, 50, 60]);
    assert.deepEqual(filas[1], ['2', 'Soda', '', '', '4', 20, 80, 20, 22, -2, 60, 75, 40]);
  });

  it('cabeceras y filas con igual ancho', () => {
    assert.equal(CABECERAS_PRODUCTO_RESUMEN.length, 13);
    assert.equal(filasProductoResumen(ventas)[0].length, 13);
  });

  it('total 0 → % de la venta 0', () => {
    const f = filasProductoResumen([
      { producto_id: BigInt(1), producto_nombre: 'X', sku_producto: null, categoria: null, cantidad: 1, venta_total: 0, costo_total: 0, costo_teorico_total: 0 },
    ]);
    assert.equal(f[0][12], 0);
  });
});

describe('filasProductoDetalle', () => {
  it('una fila por línea con empleado resuelto y fecha local', () => {
    const filas = filasProductoDetalle(
      [
        {
          fecha_venta: new Date('2026-05-02T03:30:00.000Z'),
          pedido_id: BigInt(10),
          numero_factura: '55',
          producto_nombre: 'Burger',
          sku_producto: 'B1',
          categoria: 'Comida',
          cantidad: 2,
          precio_unitario: '30.00',
          venta_total: '60.00',
          costo_total: '30.0000',
          costo_teorico_total: '24.0000',
          metodo_pago: 'cash',
          nombre_cliente: null,
          empleado_id: BigInt(1),
        },
      ],
      new Map([['1', { nombre: 'Ana', usuario: 'ana', rol: 'Cajero' }]]),
      TZ,
    );
    assert.deepEqual(filas, [
      ['2026-05-01 23:30', '10', '55', 'Burger', 'B1', 'Comida', '2', 30, 60, 30, 24, 30, 'Efectivo', '', 'Ana'],
    ]);
    assert.equal(CABECERAS_PRODUCTO_DETALLE.length, 15);
  });
});

describe('filasPorCaja', () => {
  const cajas = [
    {
      id: BigInt(1),
      cajero: 'Ana',
      estado: 'cerrada',
      fecha_apertura: new Date('2026-05-01T12:00:00.000Z'),
      fecha_cierre: new Date('2026-05-01T20:00:00.000Z'),
      saldo_inicial: '100.00',
      saldo_final: '345.00',
      diferencia_efectivo: '0.00',
      declarado_tarjeta: '50.00',
      diferencia_tarjeta: '0.00',
      declarado_qr: null,
      diferencia_qr: null,
      observaciones: 'ok',
    },
    {
      id: BigInt(2),
      cajero: 'Beto',
      estado: 'abierta',
      fecha_apertura: new Date('2026-05-02T12:00:00.000Z'),
      fecha_cierre: null,
      saldo_inicial: '0',
      saldo_final: null,
      diferencia_efectivo: null,
      declarado_tarjeta: null,
      diferencia_tarjeta: null,
      declarado_qr: null,
      diferencia_qr: null,
      observaciones: null,
    },
  ];
  const facturas = [
    { caja_id: BigInt(1), metodo_pago: 'cash', importe_total: '200.10' },
    { caja_id: BigInt(1), metodo_pago: 'cash', importe_total: '0.20' },
    { caja_id: BigInt(1), metodo_pago: 'card', importe_total: '50.00' },
    { caja_id: BigInt(1), metodo_pago: 'qr', importe_total: '10.00' },
    { caja_id: BigInt(1), metodo_pago: 'transfer', importe_total: '5.00' },
    { caja_id: BigInt(1), metodo_pago: 'giftcard', importe_total: '1.00' },
    { caja_id: BigInt(1), metodo_pago: 'crypto', importe_total: '2.00' },
    { caja_id: BigInt(2), metodo_pago: 'cash', importe_total: '30.00' },
  ];
  const movimientos = [
    { caja_id: BigInt(1), tipo: 'INGRESO', monto: '60.00' },
    { caja_id: BigInt(1), tipo: 'EGRESO', monto: '15.30' },
    { caja_id: BigInt(2), tipo: 'EGRESO', monto: '5.00' },
  ];

  it('suma por método con Decimal exacto, tickets y efectivo esperado', () => {
    const filas = filasPorCaja(cajas, facturas, movimientos, TZ);
    assert.equal(filas.length, 2);
    // esperado = 100 + 200.30 + 60 - 15.30 = 345.00
    assert.deepEqual(filas[0], [
      '1', 'Ana', 'cerrada', '2026-05-01 08:00', '2026-05-01 16:00',
      100, 200.3, 50, 10, 5, 1, 2, 268.3, '7', 60, 15.3, 345, 345, 0, 50, 0, null, null, 'ok',
    ]);
  });

  it('caja abierta: sin cierre ni conteo; esperado usa datos parciales', () => {
    const filas = filasPorCaja(cajas, facturas, movimientos, TZ);
    // esperado = 0 + 30 + 0 - 5 = 25
    assert.deepEqual(filas[1], [
      '2', 'Beto', 'abierta', '2026-05-02 08:00', '',
      0, 30, 0, 0, 0, 0, 0, 30, '1', 0, 5, 25, null, null, null, null, null, null, '',
    ]);
  });

  it('cabeceras y filas con igual ancho', () => {
    assert.equal(CABECERAS_CAJA.length, 24);
    for (const f of filasPorCaja(cajas, facturas, movimientos, TZ)) assert.equal(f.length, 24);
  });
});

describe('filasAnuladas', () => {
  const base = {
    creado_en: new Date('2026-05-02T03:30:00.000Z'),
    actualizado_en: new Date('2026-05-02T04:30:00.000Z'),
    tomado_por: 'Ana',
    caja_id: BigInt(7),
    cajero: 'Beto',
    mesa: 'Mesa 1',
    cliente_nombre: 'Juan',
    total: '90.00',
    observaciones: 'ANULADO (Admin #1): error',
  };

  it('"Estaba cobrado" = Sí cuando hay factura, con su método y número', () => {
    const [fila] = filasAnuladas(
      [{ ...base, id: BigInt(5), factura: { id: BigInt(33), metodo_pago: 'card', importe_total: '90.00' } }],
      TZ,
    );
    assert.deepEqual(fila, [
      '5', '2026-05-01 23:30', '2026-05-02 00:30', 'Ana', '7', 'Beto', 'Mesa 1', 'Juan',
      'Sí', '33', 'Tarjeta', 90, 'ANULADO (Admin #1): error',
    ]);
  });

  it('"Estaba cobrado" = No sin factura; campos nulos vacíos', () => {
    const [fila] = filasAnuladas(
      [{ ...base, id: BigInt(6), factura: null, caja_id: null, cajero: null, mesa: null }],
      TZ,
    );
    assert.deepEqual(fila, [
      '6', '2026-05-01 23:30', '2026-05-02 00:30', 'Ana', '', '', '', 'Juan',
      'No', '', '', 90, 'ANULADO (Admin #1): error',
    ]);
    assert.equal(CABECERAS_ANULADAS.length, 13);
  });
});
