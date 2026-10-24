import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "./validation";
import {
  validarEdicionEntrada,
  evaluarEditabilidad,
  EstadoEdicionEntrada,
  calcularCambiosEntrada,
  ValoresEntrada,
  recalcularCostoPromedioDesdeLotes,
  construirRegistrosAuditoria,
  CambioEntrada,
} from "./entradaEdicion";

describe("validarEdicionEntrada", () => {
  it("trims strings and normalizes accepted fields", () => {
    const r = validarEdicionEntrada({
      codigo_lote: "  L-001  ",
      referencia: " FAC-9 ",
      fecha_caducidad: "2026-12-31",
      cantidad: "10.5",
      costo_unit: 2,
    });
    assert.deepEqual(r, {
      codigo_lote: "L-001",
      referencia: "FAC-9",
      fecha_caducidad: "2026-12-31",
      cantidad: 10.5,
      costo_unit: 2,
    });
  });

  it("leaves omitted keys out of the result", () => {
    assert.deepEqual(validarEdicionEntrada({ referencia: "X" }), { referencia: "X" });
  });

  it("rejects an empty or overlong codigo_lote", () => {
    assert.throws(() => validarEdicionEntrada({ codigo_lote: "   " }), ValidationError);
    assert.throws(() => validarEdicionEntrada({ codigo_lote: "a".repeat(65) }), ValidationError);
    assert.deepEqual(validarEdicionEntrada({ codigo_lote: "a".repeat(64) }), { codigo_lote: "a".repeat(64) });
  });

  it("limits referencia to 64 chars and maps empty to null", () => {
    assert.throws(() => validarEdicionEntrada({ referencia: "r".repeat(65) }), ValidationError);
    assert.deepEqual(validarEdicionEntrada({ referencia: "" }), { referencia: null });
    assert.deepEqual(validarEdicionEntrada({ referencia: "   " }), { referencia: null });
    assert.deepEqual(validarEdicionEntrada({ referencia: null }), { referencia: null });
  });

  it("validates fecha_caducidad format and calendar date", () => {
    assert.throws(() => validarEdicionEntrada({ fecha_caducidad: "31/12/2026" }), ValidationError);
    assert.throws(() => validarEdicionEntrada({ fecha_caducidad: "2026-02-30" }), ValidationError);
    assert.throws(() => validarEdicionEntrada({ fecha_caducidad: 20261231 }), ValidationError);
    assert.deepEqual(validarEdicionEntrada({ fecha_caducidad: null }), { fecha_caducidad: null });
    assert.deepEqual(validarEdicionEntrada({ fecha_caducidad: "" }), { fecha_caducidad: null });
    assert.deepEqual(validarEdicionEntrada({ fecha_caducidad: "2028-02-29" }), { fecha_caducidad: "2028-02-29" });
  });

  it("requires cantidad > 0 and finite", () => {
    for (const bad of [0, -1, NaN, Infinity, "abc", null]) {
      assert.throws(() => validarEdicionEntrada({ cantidad: bad }), ValidationError, String(bad));
    }
  });

  it("requires costo_unit >= 0 and finite", () => {
    for (const bad of [-0.5, NaN, Infinity, "abc", null]) {
      assert.throws(() => validarEdicionEntrada({ costo_unit: bad }), ValidationError, String(bad));
    }
    assert.deepEqual(validarEdicionEntrada({ costo_unit: 0 }), { costo_unit: 0 });
  });

  it("rejects immutable keys with ValidationError", () => {
    for (const key of ["item", "item_id", "motivo", "proveedor", "proveedor_id", "sucursal_id", "tipo", "lote_id"]) {
      assert.throws(
        () => validarEdicionEntrada({ referencia: "X", [key]: 1 }),
        ValidationError,
        key
      );
    }
  });

  it("rejects non-object bodies and bodies without editable keys", () => {
    for (const bad of [null, undefined, "x", 5, [], [{ referencia: "x" }]]) {
      assert.throws(() => validarEdicionEntrada(bad), ValidationError);
    }
    assert.throws(() => validarEdicionEntrada({}), ValidationError);
    assert.throws(() => validarEdicionEntrada({ otro: 1 }), ValidationError);
  });
});

describe("evaluarEditabilidad", () => {
  const base: EstadoEdicionEntrada = {
    tipo: "Entrada",
    motivo: "Compra",
    loteId: BigInt(7),
    movimientoId: BigInt(100),
    cantidadMovimiento: 10,
    primerMovimientoLoteId: BigInt(100),
    totalMovimientosLote: 1,
    consumosProduccionLote: 0,
    cantidadStockLote: 10,
  };

  it("allows full edit of an untouched originating Compra, Ajuste or Traslado", () => {
    for (const motivo of ["Compra", "Ajuste", "Traslado"]) {
      assert.deepEqual(evaluarEditabilidad({ ...base, motivo }), {
        editable: true,
        cantidadCostoEditables: true,
      });
    }
  });

  it("rejects Produccion, restoration Ajuste, Salida and entries without lote", () => {
    const noEditable = { editable: false, cantidadCostoEditables: false };
    assert.deepEqual(evaluarEditabilidad({ ...base, motivo: "Produccion" }), noEditable);
    assert.deepEqual(
      evaluarEditabilidad({ ...base, motivo: "Ajuste", movimientoId: BigInt(150), totalMovimientosLote: 2 }),
      noEditable
    );
    assert.deepEqual(evaluarEditabilidad({ ...base, tipo: "Salida" }), noEditable);
    assert.deepEqual(evaluarEditabilidad({ ...base, loteId: null }), noEditable);
  });

  it("limits to metadata when the lote has other movements", () => {
    assert.deepEqual(evaluarEditabilidad({ ...base, totalMovimientosLote: 2 }), {
      editable: true,
      cantidadCostoEditables: false,
    });
  });

  it("limits to metadata when production consumed the lote", () => {
    assert.deepEqual(evaluarEditabilidad({ ...base, consumosProduccionLote: 1 }), {
      editable: true,
      cantidadCostoEditables: false,
    });
  });

  it("limits to metadata when stock differs from the movement quantity", () => {
    assert.deepEqual(evaluarEditabilidad({ ...base, cantidadStockLote: 9 }), {
      editable: true,
      cantidadCostoEditables: false,
    });
  });

  it("compares stock and movement quantity after rounding to 3 decimals", () => {
    assert.deepEqual(
      evaluarEditabilidad({ ...base, cantidadMovimiento: 1.0004, cantidadStockLote: 1 }),
      { editable: true, cantidadCostoEditables: true }
    );
    assert.deepEqual(
      evaluarEditabilidad({ ...base, cantidadMovimiento: 1.002, cantidadStockLote: 1 }),
      { editable: true, cantidadCostoEditables: false }
    );
  });

  it("limits to metadata when there is no stock row for the sucursal", () => {
    assert.deepEqual(evaluarEditabilidad({ ...base, cantidadStockLote: null }), {
      editable: true,
      cantidadCostoEditables: false,
    });
  });
});

describe("calcularCambiosEntrada", () => {
  const actual: ValoresEntrada = {
    codigo_lote: "L-001",
    fecha_caducidad: null,
    referencia: "FAC-1",
    cantidad: 10,
    costo_unit: 2,
  };

  it("returns no changes when every requested value equals the current one", () => {
    assert.deepEqual(
      calcularCambiosEntrada(actual, {
        codigo_lote: "L-001",
        referencia: "FAC-1",
        cantidad: 10,
        costo_unit: 2,
        fecha_caducidad: null,
      }),
      []
    );
  });

  it("treats values equal after normalization as unchanged", () => {
    const conDecimales = { ...actual, cantidad: 10.0004, costo_unit: 0.0035 };
    assert.deepEqual(
      calcularCambiosEntrada(conDecimales, { cantidad: 10, costo_unit: 0.0035000004 }),
      []
    );
  });

  it("reports cost 2 -> 2.5 as fixed 6-decimal strings", () => {
    assert.deepEqual(calcularCambiosEntrada(actual, { costo_unit: 2.5 }), [
      { campo: "costo_unit", anterior: "2.000000", nuevo: "2.500000" },
    ]);
  });

  it("reports cantidad as fixed 3-decimal strings", () => {
    assert.deepEqual(calcularCambiosEntrada(actual, { cantidad: 12.5 }), [
      { campo: "cantidad", anterior: "10.000", nuevo: "12.500" },
    ]);
  });

  it("handles fecha_caducidad set, clear and same day", () => {
    assert.deepEqual(calcularCambiosEntrada(actual, { fecha_caducidad: "2026-12-31" }), [
      { campo: "fecha_caducidad", anterior: null, nuevo: "2026-12-31" },
    ]);
    const conFecha = { ...actual, fecha_caducidad: new Date("2026-12-31T00:00:00.000Z") };
    assert.deepEqual(calcularCambiosEntrada(conFecha, { fecha_caducidad: null }), [
      { campo: "fecha_caducidad", anterior: "2026-12-31", nuevo: null },
    ]);
    assert.deepEqual(calcularCambiosEntrada(conFecha, { fecha_caducidad: "2026-12-31" }), []);
  });

  it("treats null and empty referencia as equal and detects real changes", () => {
    const sinReferencia = { ...actual, referencia: null };
    assert.deepEqual(calcularCambiosEntrada(sinReferencia, { referencia: null }), []);
    assert.deepEqual(calcularCambiosEntrada(sinReferencia, { referencia: "FAC-2" }), [
      { campo: "referencia", anterior: null, nuevo: "FAC-2" },
    ]);
    assert.deepEqual(calcularCambiosEntrada(actual, { referencia: null }), [
      { campo: "referencia", anterior: "FAC-1", nuevo: null },
    ]);
  });

  it("does not count the same codigo_lote as a change", () => {
    assert.deepEqual(calcularCambiosEntrada(actual, { codigo_lote: "L-001" }), []);
    assert.deepEqual(calcularCambiosEntrada(actual, { codigo_lote: "L-002" }), [
      { campo: "codigo_lote", anterior: "L-001", nuevo: "L-002" },
    ]);
  });

  it("returns several changes in stable CAMPOS_AUDITABLES order", () => {
    const cambios = calcularCambiosEntrada(actual, {
      costo_unit: 3,
      referencia: "FAC-9",
      codigo_lote: "L-009",
      cantidad: 4,
    });
    assert.deepEqual(
      cambios.map((c) => c.campo),
      ["codigo_lote", "referencia", "cantidad", "costo_unit"]
    );
  });
});

describe("recalcularCostoPromedioDesdeLotes", () => {
  it("averages the item lots weighted by quantity", () => {
    const lotes = [
      { lote_id: BigInt(1), cantidad: 10, costo_unit: 2 },
      { lote_id: BigInt(2), cantidad: 5, costo_unit: 5 },
    ];
    // Replacement equals the current lot 1 values: (10*2 + 5*5) / 15
    assert.equal(
      recalcularCostoPromedioDesdeLotes(lotes, { lote_id: BigInt(1), cantidad: 10, costo_unit: 2 }),
      3
    );
  });

  it("replaces the edited lote with its post-edit values", () => {
    const lotes = [
      { lote_id: BigInt(1), cantidad: 10, costo_unit: 2 },
      { lote_id: BigInt(2), cantidad: 6, costo_unit: 1 },
    ];
    // (4*3 + 6*1) / 10
    assert.equal(
      recalcularCostoPromedioDesdeLotes(lotes, { lote_id: BigInt(1), cantidad: 4, costo_unit: 3 }),
      1.8
    );
  });

  it("appends the edited lote when it is missing from the list", () => {
    const lotes = [{ lote_id: BigInt(2), cantidad: 6, costo_unit: 1 }];
    assert.equal(
      recalcularCostoPromedioDesdeLotes(lotes, { lote_id: BigInt(1), cantidad: 4, costo_unit: 3 }),
      1.8
    );
  });

  it("rounds the result to 6 decimals", () => {
    const lotes = [{ lote_id: BigInt(2), cantidad: 2, costo_unit: 1.5 }];
    // (1*1 + 2*1.5) / 3 = 1.3333...
    assert.equal(
      recalcularCostoPromedioDesdeLotes(lotes, { lote_id: BigInt(1), cantidad: 1, costo_unit: 1 }),
      1.333333
    );
  });

  it("ignores rows with zero quantity", () => {
    const lotes = [
      { lote_id: BigInt(2), cantidad: 6, costo_unit: 1 },
      { lote_id: BigInt(3), cantidad: 0, costo_unit: 100 },
    ];
    assert.equal(
      recalcularCostoPromedioDesdeLotes(lotes, { lote_id: BigInt(1), cantidad: 4, costo_unit: 3 }),
      1.8
    );
  });

  it("returns the replacement cost for an empty list", () => {
    assert.equal(
      recalcularCostoPromedioDesdeLotes([], { lote_id: BigInt(1), cantidad: 4, costo_unit: 3.25 }),
      3.25
    );
  });

  it("falls back to the rounded replacement cost when total quantity is not positive", () => {
    assert.equal(
      recalcularCostoPromedioDesdeLotes([], { lote_id: BigInt(1), cantidad: 0, costo_unit: 1.23456789 }),
      1.234568
    );
  });
});

describe("construirRegistrosAuditoria", () => {
  const ctx = { movimientoId: BigInt(100), loteId: BigInt(7), sucursalId: BigInt(1), empleadoId: BigInt(5) };

  it("builds one row per change with the full context", () => {
    const cambios: CambioEntrada[] = [
      { campo: "codigo_lote", anterior: "L-001", nuevo: "L-002" },
      { campo: "referencia", anterior: "FAC-1", nuevo: "FAC-2" },
    ];
    assert.deepEqual(construirRegistrosAuditoria(cambios, ctx), [
      {
        movimiento_id: BigInt(100),
        lote_id: BigInt(7),
        sucursal_id: BigInt(1),
        empleado_id: BigInt(5),
        campo: "codigo_lote",
        valor_anterior: "L-001",
        valor_nuevo: "L-002",
      },
      {
        movimiento_id: BigInt(100),
        lote_id: BigInt(7),
        sucursal_id: BigInt(1),
        empleado_id: BigInt(5),
        campo: "referencia",
        valor_anterior: "FAC-1",
        valor_nuevo: "FAC-2",
      },
    ]);
  });

  it("keeps a null previous value when fecha_caducidad is first set", () => {
    const [fila] = construirRegistrosAuditoria(
      [{ campo: "fecha_caducidad", anterior: null, nuevo: "2026-12-31" }],
      ctx
    );
    assert.equal(fila.campo, "fecha_caducidad");
    assert.equal(fila.valor_anterior, null);
    assert.equal(fila.valor_nuevo, "2026-12-31");
  });

  it("returns no rows when there are no changes", () => {
    assert.equal(construirRegistrosAuditoria([], ctx).length, 0);
  });
});
