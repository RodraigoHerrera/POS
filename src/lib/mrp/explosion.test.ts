import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { explotarMPS, type MapaRecetas } from "./explosion";

const recetas: MapaRecetas = new Map([
  // vendible V1: 1 porción = 0.5 de PREP
  ["V1", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "PREP", itemInsumoTipo: "prep", cantidad: 0.5, mermaPctRecetaItem: 0 }] }],
  ["V2", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "PREP", itemInsumoTipo: "prep", cantidad: 1, mermaPctRecetaItem: 0 }] }],
  // PREP: rinde 1 y usa 2 de RAW por unidad
  ["PREP", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "RAW", itemInsumoTipo: "insumo", cantidad: 2, mermaPctRecetaItem: 0 }] }],
  // cadena: V3 -> PREP_A -> PREP_B -> RAW2
  ["V3", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "PREP_A", itemInsumoTipo: "prep", cantidad: 1, mermaPctRecetaItem: 0 }] }],
  ["PREP_A", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "PREP_B", itemInsumoTipo: "prep", cantidad: 1, mermaPctRecetaItem: 0 }] }],
  ["PREP_B", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "RAW2", itemInsumoTipo: "insumo", cantidad: 3, mermaPctRecetaItem: 0 }] }],
]);

const cant = (r: { requerimientos: { itemId: string; cantidadBruta: number }[] }, id: string) =>
  r.requerimientos.find((x) => x.itemId === id)?.cantidadBruta;

describe("explotarMPS - neteo de stock de preps", () => {
  it("prep con stock 5 y requerimiento 10 explota insumos solo por 5", () => {
    const r = explotarMPS([{ itemId: "V2", tipo: "vendible", cantidad: 10 }], recetas, new Map([["PREP", 5]]));
    assert.equal(cant(r, "RAW"), 10); // 5 * 2
    assert.equal(cant(r, "PREP"), undefined);
  });

  it("stock de prep mayor al requerimiento no explota nada", () => {
    const r = explotarMPS([{ itemId: "V2", tipo: "vendible", cantidad: 10 }], recetas, new Map([["PREP", 50]]));
    assert.equal(r.requerimientos.length, 0);
  });

  it("el mismo prep demandado por dos productos consume el stock una sola vez", () => {
    const stock = new Map([["PREP", 5]]);
    const r = explotarMPS(
      [
        { itemId: "V2", tipo: "vendible", cantidad: 4 }, // requiere 4
        { itemId: "V1", tipo: "vendible", cantidad: 12 }, // requiere 6
      ],
      recetas,
      stock
    );
    // total requerido 10, stock 5 => explota 5 => RAW 10
    assert.equal(cant(r, "RAW"), 10);
    assert.equal(stock.get("PREP"), 0);
  });

  it("el stock se comparte entre llamadas sucesivas con el mismo mapa", () => {
    const stock = new Map([["PREP", 5]]);
    const a = explotarMPS([{ itemId: "V2", tipo: "vendible", cantidad: 4 }], recetas, stock);
    const b = explotarMPS([{ itemId: "V2", tipo: "vendible", cantidad: 4 }], recetas, stock);
    assert.equal(cant(a, "RAW"), undefined);
    assert.equal(cant(b, "RAW"), 6); // 3 restantes * 2
  });

  it("cadena de 2 niveles con stock en el nivel intermedio", () => {
    const r = explotarMPS([{ itemId: "V3", tipo: "vendible", cantidad: 10 }], recetas, new Map([["PREP_B", 4]]));
    assert.equal(cant(r, "RAW2"), 18); // (10-4) * 3
    const r2 = explotarMPS([{ itemId: "V3", tipo: "vendible", cantidad: 10 }], recetas, new Map([["PREP_A", 10]]));
    assert.equal(r2.requerimientos.length, 0);
  });

  it("stock cero o indefinido no cambia el comportamiento", () => {
    const base = explotarMPS([{ itemId: "V2", tipo: "vendible", cantidad: 10 }], recetas);
    const cero = explotarMPS([{ itemId: "V2", tipo: "vendible", cantidad: 10 }], recetas, new Map([["PREP", 0]]));
    assert.deepEqual(cero.requerimientos, base.requerimientos);
    assert.equal(cant(base, "RAW"), 20);
  });

  it("reporta los preps consumidos de stock", () => {
    const r = explotarMPS([{ itemId: "V2", tipo: "vendible", cantidad: 10 }], recetas, new Map([["PREP", 5]]));
    assert.deepEqual(r.prepsDeStock, [{ itemId: "PREP", cantidad: 5 }]);
  });

  it("mantiene merma y rendimiento", () => {
    const rec: MapaRecetas = new Map([
      ["P", { rendimiento: 2, mermaPctReceta: 50, insumos: [{ itemInsumoId: "R", itemInsumoTipo: "insumo", cantidad: 1, mermaPctRecetaItem: 0 }] }],
    ]);
    const r = explotarMPS([{ itemId: "P", tipo: "prep", cantidad: 4 }], rec);
    assert.equal(cant(r, "R"), 4); // 4/2/0.5 * 1
  });

  it("mantiene la advertencia de ciclo", () => {
    const rec: MapaRecetas = new Map([
      ["A", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "B", itemInsumoTipo: "prep", cantidad: 1, mermaPctRecetaItem: 0 }] }],
      ["B", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "A", itemInsumoTipo: "prep", cantidad: 1, mermaPctRecetaItem: 0 }] }],
    ]);
    const r = explotarMPS([{ itemId: "A", tipo: "prep", cantidad: 1 }], rec);
    assert.ok(r.advertencias.some((a) => a.mensaje.includes("Ciclo")));
  });
});

describe("explotarMPS - merma >= 100%", () => {
  it("advierte cuando la merma de receta es 100% en lugar de multiplicar x100 en silencio", () => {
    const m: MapaRecetas = new Map([
      ["V", { rendimiento: 1, mermaPctReceta: 100, insumos: [{ itemInsumoId: "RAW", itemInsumoTipo: "insumo", cantidad: 1, mermaPctRecetaItem: 0 }] }],
    ]);
    const r = explotarMPS([{ itemId: "V", tipo: "vendible", cantidad: 1 }], m);
    assert.ok(r.advertencias.some((a) => a.itemId === "V" && /merma/i.test(a.mensaje)));
  });
  it("advierte cuando la merma de una linea de insumo es >= 100%", () => {
    const m: MapaRecetas = new Map([
      ["V", { rendimiento: 1, mermaPctReceta: 0, insumos: [{ itemInsumoId: "RAW", itemInsumoTipo: "insumo", cantidad: 1, mermaPctRecetaItem: 120 }] }],
    ]);
    const r = explotarMPS([{ itemId: "V", tipo: "vendible", cantidad: 1 }], m);
    assert.ok(r.advertencias.some((a) => a.itemId === "RAW" && /merma/i.test(a.mensaje)));
  });
  it("sin merma excesiva no hay advertencias", () => {
    const r = explotarMPS([{ itemId: "V2", tipo: "vendible", cantidad: 1 }], recetas);
    assert.equal(r.advertencias.length, 0);
  });
});

describe("explotarMPS - nombres en mensajes", () => {
  it("usa el nombre del item cuando se provee", () => {
    const r = explotarMPS([{ itemId: "V9", tipo: "vendible", cantidad: 1 }], new Map(), undefined, new Map([["V9", "Hamburguesa"]]));
    assert.match(r.advertencias[0].mensaje, /Hamburguesa/);
  });
});
