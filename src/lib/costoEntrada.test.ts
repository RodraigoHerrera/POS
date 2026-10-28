import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "./validation";
import { costoUnitarioDesdeTotal, resolverCostoUnitario } from "./costoEntrada";

describe("costoUnitarioDesdeTotal", () => {
  it("divide exacto", () => {
    assert.equal(costoUnitarioDesdeTotal(100, 4), 25);
    assert.equal(costoUnitarioDesdeTotal("50", "8"), 6.25);
  });

  it("redondea a 6 decimales en divisiones periódicas", () => {
    assert.equal(costoUnitarioDesdeTotal(100, 3), 33.333333);
    assert.equal(costoUnitarioDesdeTotal(200, 3), 66.666667);
  });

  it("total 0 da costo unitario 0", () => {
    assert.equal(costoUnitarioDesdeTotal(0, 5), 0);
  });

  it("rechaza total inválido o negativo", () => {
    assert.throws(() => costoUnitarioDesdeTotal(-1, 5), ValidationError);
    assert.throws(() => costoUnitarioDesdeTotal(NaN, 5), ValidationError);
    assert.throws(() => costoUnitarioDesdeTotal("abc", 5), ValidationError);
    assert.throws(() => costoUnitarioDesdeTotal(Infinity, 5), ValidationError);
    assert.throws(() => costoUnitarioDesdeTotal(null, 5), ValidationError);
    assert.throws(() => costoUnitarioDesdeTotal("", 5), ValidationError);
  });

  it("rechaza cantidad inválida o <= 0", () => {
    assert.throws(() => costoUnitarioDesdeTotal(10, 0), ValidationError);
    assert.throws(() => costoUnitarioDesdeTotal(10, -2), ValidationError);
    assert.throws(() => costoUnitarioDesdeTotal(10, "x"), ValidationError);
    assert.throws(() => costoUnitarioDesdeTotal(10, undefined), ValidationError);
  });
});

describe("resolverCostoUnitario", () => {
  it("devuelve el unitario tal cual cuando solo hay unitario", () => {
    assert.equal(resolverCostoUnitario({ costo_unit: "2.5", cantidad: 4 }), 2.5);
    assert.equal(resolverCostoUnitario({ costo_unit: 0, cantidad: 4 }), 0);
  });

  it("calcula desde el total cuando solo hay total", () => {
    assert.equal(resolverCostoUnitario({ costo_total: 100, cantidad: 3 }), 33.333333);
  });

  it("rechaza enviar ambos", () => {
    assert.throws(
      () => resolverCostoUnitario({ costo_unit: 1, costo_total: 3, cantidad: 3 }),
      ValidationError
    );
  });

  it("devuelve undefined si no hay ninguno (null cuenta como ausente)", () => {
    assert.equal(resolverCostoUnitario({ cantidad: 3 }), undefined);
    assert.equal(resolverCostoUnitario({ costo_unit: null, costo_total: null, cantidad: 3 }), undefined);
  });

  it("valida el unitario no negativo", () => {
    assert.throws(() => resolverCostoUnitario({ costo_unit: -1, cantidad: 3 }), ValidationError);
  });
});
