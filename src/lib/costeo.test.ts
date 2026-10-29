import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcularCostoReceta,
  costoTeoricoDesdeRequerimientos,
  type CostoReferenciaInsumo,
} from "./costeo";

describe("costoTeoricoDesdeRequerimientos", () => {
  it("calcula el costo total ponderado de requerimientos", () => {
    const mapa = new Map<string, CostoReferenciaInsumo>([
      ["1", { costo: 10, fuente: "estandar" }],
      ["2", { costo: 5.5, fuente: "promedio" }],
    ]);

    const reqs = [
      { insumoId: BigInt(1), cantidadRequerida: 2 }, // 20
      { insumoId: BigInt(2), cantidadRequerida: 3 }, // 16.5
    ];

    const total = costoTeoricoDesdeRequerimientos(reqs, mapa);
    assert.equal(total, 36.5);
  });

  it("asume costo 0 para insumos no presentes en el mapa", () => {
    const mapa = new Map<string, CostoReferenciaInsumo>([
      ["1", { costo: 10, fuente: "estandar" }],
    ]);

    const reqs = [
      { insumoId: BigInt(1), cantidadRequerida: 2 },
      { insumoId: BigInt(99), cantidadRequerida: 5 },
    ];

    const total = costoTeoricoDesdeRequerimientos(reqs, mapa);
    assert.equal(total, 20);
  });
});

describe("calcularCostoReceta", () => {
  it("suma correctamente cantidad × costoReferencia", () => {
    const mapa = new Map<string, CostoReferenciaInsumo>([
      ["10", { costo: 2.5, fuente: "estandar" }],
      ["20", { costo: 1.2, fuente: "promedio" }],
    ]);

    const items = [
      { item_insumo_id: BigInt(10), cantidad: 4 }, // 10.0
      { item_insumo_id: "20", cantidad: 2.5 }, // 3.0
    ];

    const total = calcularCostoReceta(items, mapa);
    assert.equal(total, 13);
  });

  it("devuelve 0 si la receta no tiene items", () => {
    const mapa = new Map<string, CostoReferenciaInsumo>([
      ["10", { costo: 2.5, fuente: "estandar" }],
    ]);

    const total = calcularCostoReceta([], mapa);
    assert.equal(total, 0);
  });

  it("devuelve 0 si ningún insumo tiene costo de referencia", () => {
    const mapa = new Map<string, CostoReferenciaInsumo>();
    const items = [{ item_insumo_id: BigInt(10), cantidad: 5 }];

    const total = calcularCostoReceta(items, mapa);
    assert.equal(total, 0);
  });
});
