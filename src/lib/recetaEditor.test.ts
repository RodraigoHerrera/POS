import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toInsumoOptions, withMissingOptions } from "./recetaEditor";

describe("toInsumoOptions", () => {
  it("excludes vendible items", () => {
    const options = toInsumoOptions([
      { id: 1, nombre: "Carne", tipo: "insumo", unidad_code: "kg" },
      { id: 2, nombre: "Hamburguesa", tipo: "vendible", unidad_code: "u" },
    ]);
    assert.deepEqual(options, [{ value: "1", label: "Carne (kg)" }]);
  });

  it("formats the label as Nombre (unidad) and falls back to u", () => {
    const options = toInsumoOptions([
      { id: "3", nombre: "Pan", tipo: "insumo", unidad_code: null },
      { id: 4, nombre: "Sal", tipo: "insumo" },
    ]);
    assert.deepEqual(options, [
      { value: "3", label: "Pan (u)" },
      { value: "4", label: "Sal (u)" },
    ]);
  });
});

describe("withMissingOptions", () => {
  const base = [
    { value: "1", label: "Carne (kg)" },
    { value: "2", label: "Pan (u)" },
  ];

  it("appends insumos missing from the options with the same label format", () => {
    const result = withMissingOptions(base, [
      { itemId: "9", nombre: "Queso", unidad_code: "kg" },
      { itemId: "10", nombre: "Sal" },
    ]);
    assert.deepEqual(result, [
      ...base,
      { value: "9", label: "Queso (kg)" },
      { value: "10", label: "Sal (u)" },
    ]);
  });

  it("does not duplicate options already present or repeated rows", () => {
    const result = withMissingOptions(base, [
      { itemId: "1", nombre: "Carne", unidad_code: "kg" },
      { itemId: "9", nombre: "Queso", unidad_code: "kg" },
      { itemId: "9", nombre: "Queso", unidad_code: "kg" },
    ]);
    assert.deepEqual(result, [...base, { value: "9", label: "Queso (kg)" }]);
  });

  it("ignores rows with an empty itemId", () => {
    const result = withMissingOptions(base, [{ itemId: "", nombre: "" }]);
    assert.deepEqual(result, base);
  });

  it("preserves the original order and does not mutate the input", () => {
    const input = [...base];
    const result = withMissingOptions(input, [{ itemId: "9", nombre: "Queso", unidad_code: "kg" }]);
    assert.deepEqual(result.slice(0, 2), base);
    assert.deepEqual(input, base);
  });
});
