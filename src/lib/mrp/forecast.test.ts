import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cantidadMps } from "./forecast";
import { explotarMPS, type MapaRecetas } from "./explosion";

describe("cantidadMps", () => {
  it("conserva pronosticos fraccionarios menores a 0.5", () => {
    assert.equal(cantidadMps(0.4), 0.4);
  });
  it("redondea a 3 decimales (precision de la columna)", () => {
    assert.equal(cantidadMps(1.23456), 1.235);
  });
  it("negativos, NaN e infinitos dan 0", () => {
    assert.equal(cantidadMps(-3), 0);
    assert.equal(cantidadMps(NaN), 0);
    assert.equal(cantidadMps(Infinity), 0);
  });
  it("un pronostico de 0.4 llega a la explosion", () => {
    const recetas: MapaRecetas = new Map([
      ["V", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "RAW", itemInsumoTipo: "insumo", cantidad: 10, mermaPctRecetaItem: 0 }] }],
    ]);
    const mps = cantidadMps(0.4);
    assert.ok(mps > 0);
    const r = explotarMPS([{ itemId: "V", tipo: "vendible", cantidad: mps }], recetas);
    assert.equal(r.requerimientos[0].cantidadBruta, 4);
  });
});
